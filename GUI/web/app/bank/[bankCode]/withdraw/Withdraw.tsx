'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CreditCard, Loader2, CheckCircle, XCircle, Banknote } from 'lucide-react';
import { getBankByCode, BankUser } from '@/config/banks';
import { formatVND, MOCK_MODE } from '@/config/blockchain';
import { formatAddress, getBalanceVND, sendTransaction, waitForTransaction, getWallet } from '@/lib/blockchain';
import { getBalanceForUser } from '@/lib/balances';
import { isContractDeployed, getContractBalance, withdrawViaContract } from '@/lib/contract';
import { saveTransaction, generateReferenceCode, updateTransactionStatus, saveUserBalance, getStoredBalance } from '@/lib/storage';
import { Transaction } from '@/types/transaction';

// Withdrawal address: Bank's withdrawal address (burn address for simplicity)
// In production, this should be a real bank withdrawal account
const WITHDRAWAL_ADDRESS = '0x0000000000000000000000000000000000000000'; // Burn address

export default function Withdraw() {
  const params = useParams();
  const router = useRouter();
  const bankCode = params.bankCode as string;

  const [user, setUser] = useState<BankUser | null>(null);
  const [amount, setAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [referenceCode, setReferenceCode] = useState('');
  const [balance, setBalance] = useState<number | null>(null); // Start with null, load real balance
  const [isRealBalance, setIsRealBalance] = useState(false); // Track if balance is from blockchain (real) or file (fallback)
  const [useContract, setUseContract] = useState<boolean | null>(null); // Track if using contract

  useEffect(() => {
    const bank = getBankByCode(bankCode);
    if (!bank) return;

    const savedUserId = localStorage.getItem('interbank_selected_user');
    const selectedUser = bank.users.find((u) => u.id === savedUserId) || bank.users[0];
    setUser(selectedUser);
    
    if (selectedUser) {
      checkContractStatus();
      loadBalance(selectedUser.address);
    }
  }, [bankCode]);

  // Check if contract is deployed
  const checkContractStatus = async () => {
    try {
      const deployed = await isContractDeployed();
      setUseContract(deployed);
      console.log(`Withdraw - Contract status: ${deployed ? 'Deployed - Using smart contract' : 'Not deployed - Using native transfer'}`);
    } catch (error) {
      console.error('Error checking contract status:', error);
      setUseContract(false);
    }
  };

  const loadBalance = async (address: string) => {
    console.log('🔄 Withdraw - loadBalance - Starting balance load for:', address);
    setIsRealBalance(false); // Reset trước khi load

    // 1. Ưu tiên: Kiểm tra LocalStorage (số dư mới nhất sau giao dịch)
    try {
      const storedBalance = getStoredBalance(address);
      if (storedBalance !== null) {
        console.log('💾 Withdraw - Loaded balance from LocalStorage:', storedBalance);
        setBalance(storedBalance);
        // Vẫn tiếp tục load từ contract để cập nhật (nếu có)
        setIsRealBalance(MOCK_MODE);
      }
    } catch (error) {
      console.error('Error loading balance from storage:', error);
    }

    // 2. Thử lấy từ contract (kiểm tra trực tiếp, không cần useContract state)
    try {
      console.log('📋 Withdraw - Attempting to load balance from contract...');
      const contractBalance = await getContractBalance(address);
      if (contractBalance !== null && contractBalance >= 0) {
        console.log('✅ Withdraw - Loaded balance from contract:', contractBalance);
        setBalance(contractBalance);
        setIsRealBalance(true); // Contract balance là số dư thật
        setUseContract(true); // Update useContract state
        return;
      } else {
        console.log('⚠️ Withdraw - Contract balance is null or negative, trying native balance...');
      }
    } catch (error) {
      console.error('❌ Withdraw - Error loading balance from contract:', error);
      setUseContract(false);
    }

    // 3. Thử lấy từ Blockchain (native balance)
    try {
      console.log('📋 Withdraw - Attempting to load native balance...');
      const blockchainBalance = await getBalanceVND(address);
      if (blockchainBalance !== null && blockchainBalance >= 0) {
        console.log('✅ Withdraw - Loaded native balance:', blockchainBalance);
        setBalance(blockchainBalance);
        setIsRealBalance(true); // Đánh dấu đây là số dư thật từ blockchain
        return;
      }
    } catch (error) {
      console.error('❌ Withdraw - Error loading balance from blockchain:', error);
    }
    
    // 4. Nếu Blockchain lỗi, lấy từ File chỉ để HIỂN THỊ (không dùng để validate)
    try {
      const fileBalance = await getBalanceForUser(address);
      if (fileBalance !== null && fileBalance >= 0) {
        console.log('📄 Withdraw - Loaded balance from file:', fileBalance, '(fallback only)');
        setBalance(fileBalance);
        setIsRealBalance(false); // Đánh dấu đây là số dư tham khảo (ảo) từ file
        return;
      }
    } catch (error) {
      console.error('Error loading balance from file:', error);
    }
    
    // Last resort: set to 0 if nothing works (coi 0 là số dư thật để chặn giao dịch)
    console.log('⚠️ Withdraw - All balance sources failed, setting to 0');
    setBalance(0);
    setIsRealBalance(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setMessage({ type: 'error', text: 'Vui lòng chọn người dùng' });
      return;
    }

    // VALIDATION: Đảm bảo user chỉ có thể rút từ account của chính họ
    // Kiểm tra privateKey match với address
    try {
      const wallet = getWallet(user.privateKey);
      const walletAddress = wallet.address.toLowerCase();
      const userAddress = user.address.toLowerCase();
      
      if (walletAddress !== userAddress) {
        console.error('❌ Security Error: PrivateKey không khớp với address!');
        console.error(`   PrivateKey address: ${walletAddress}`);
        console.error(`   User address: ${userAddress}`);
        setMessage({ 
          type: 'error', 
          text: 'Lỗi bảo mật: Private key không khớp với địa chỉ tài khoản. Chỉ có thể rút tiền từ tài khoản của chính bạn.' 
        });
        return;
      }
      console.log('✅ Validation passed: PrivateKey matches user address');
    } catch (error: any) {
      console.error('❌ Error validating private key:', error);
      setMessage({ 
        type: 'error', 
        text: 'Lỗi xác thực: Không thể xác minh quyền truy cập tài khoản.' 
      });
      return;
    }

    if (!amount) {
      setMessage({ type: 'error', text: 'Vui lòng nhập số tiền' });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setMessage({ type: 'error', text: 'Số tiền không hợp lệ' });
      return;
    }

    // BLOCK GIAO DỊCH NẾU SỐ DƯ LÀ ẢO (từ file, không phải blockchain)
    // Trừ khi đang ở MOCK_MODE (cho phép test/demo)
    if (!isRealBalance && !MOCK_MODE) {
      setMessage({
        type: 'error',
        text: 'Đang hiển thị số dư ngoại tuyến. Không thể thực hiện giao dịch lúc này. Vui lòng thử lại sau.',
      });
      // Thử load lại số dư thật từ blockchain
      if (user) {
        loadBalance(user.address);
      }
      return;
    }
    
    // Cảnh báo nếu đang dùng MOCK_MODE
    if (MOCK_MODE && !isRealBalance) {
      console.warn('⚠️ MOCK_MODE: Cho phép rút tiền với số dư ngoại tuyến');
    }

    // Check balance is loaded
    if (balance === null) {
      setMessage({
        type: 'error',
        text: 'Chưa tải được số dư. Vui lòng đợi một chút và thử lại.',
      });
      // Try reload balance
      if (user) {
        loadBalance(user.address);
      }
      return;
    }

    if (balance >= 0 && amountNum > balance) {
      setMessage({
        type: 'error',
        text: `Số dư không đủ. Số dư hiện tại: ${formatVND(balance)}, Số tiền cần: ${formatVND(amountNum)}`,
      });
      return;
    }


    if (!showOtp) {
      // Generate OTP (mock)
      const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setShowOtp(true);
      setMessage({ type: 'success', text: `Mã OTP: ${mockOtp} (Mock - dùng mã này để xác nhận)` });
      return;
    }

    if (otp.length !== 6) {
      setMessage({ type: 'error', text: 'Mã OTP không hợp lệ' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      const refCode = generateReferenceCode();
      setReferenceCode(refCode);

      // Check balance before sending
      if (balance === null || balance < amountNum) {
        setMessage({
          type: 'error',
          text: `Số dư không đủ. Số dư hiện tại: ${balance !== null ? formatVND(balance) : 'Không xác định'}, Số tiền cần: ${formatVND(amountNum)}`,
        });
        setIsProcessing(false);
        return;
      }

      // Send blockchain transaction to withdrawal address (burn address)
      // This actually deducts money from the blockchain
      let txHash: string | undefined;
      let blockNumber: number | undefined;
      let transactionStatus: Transaction['status'] = 'pending';

      try {
        // VALIDATION: Đảm bảo privateKey vẫn match với address trước khi gửi transaction
        const wallet = getWallet(user.privateKey);
        if (wallet.address.toLowerCase() !== user.address.toLowerCase()) {
          throw new Error('Lỗi bảo mật: Private key không khớp với địa chỉ tài khoản. Chỉ có thể rút tiền từ tài khoản của chính bạn.');
        }
        
        // Check if contract is deployed and use contract withdraw if available
        const contractDeployed = useContract !== null ? useContract : await isContractDeployed();
        
        if (contractDeployed) {
          // Use contract withdraw function (trừ tiền từ contract balance)
          console.log('💰 Using contract withdraw function...');
          const result = await withdrawViaContract(
            user.privateKey,
            amountNum,
            'Rút tiền'
          );
          txHash = result.txHash;
          console.log(`✅ Withdraw via contract successful! Tx Hash: ${txHash}, Tx ID: ${result.txId}`);
        } else {
          // Fallback: Send native transaction to withdrawal address
          console.log('💰 Using native transaction (contract not deployed)...');
          const txResponse = await sendTransaction(
            user.privateKey,
            WITHDRAWAL_ADDRESS, // Send to withdrawal/burn address
            amountNum,
            'Rút tiền'
          );
          txHash = txResponse.hash;
        }

        // Create withdrawal transaction record (giống như transfer transaction)
        const transaction: Transaction = {
          id: refCode,
          type: 'withdrawal',
          status: 'pending',
          from: user.address,
          to: WITHDRAWAL_ADDRESS, // Withdrawal address (burn address)
          amount: amountNum,
          amountWei: '',
          fee: 0,
          description: 'Rút tiền',
          referenceCode: refCode,
          timestamp: new Date(),
          fromBank: user.id.split('_')[0],
          toBank: 'WITHDRAWAL', // Đánh dấu là withdrawal
          txHash,
        };

        // Save transaction với txHash
        saveTransaction(transaction, bankCode, user.address);
        updateTransactionStatus(bankCode, user.address, txHash, 'pending');
        console.log(`✅ Withdrawal transaction saved with txHash: ${txHash}`);

        // Wait for transaction confirmation
        console.log(`⏳ Waiting for withdrawal transaction confirmation: ${txHash}`);
        const receipt = await waitForTransaction(txHash);
        if (receipt && receipt.status === 1) {
          // Transaction thành công - tiền đã bị trừ từ blockchain
          transactionStatus = 'completed';
          blockNumber = receipt.blockNumber;
          console.log(`✅ Withdrawal transaction confirmed in block: ${blockNumber}`);
          
          // Update transaction status và blockNumber
          updateTransactionStatus(bankCode, user.address, txHash, 'completed', blockNumber);
          
          // Update transaction record với blockNumber (re-save với đầy đủ thông tin)
          const updatedTransaction: Transaction = {
            ...transaction,
            status: 'completed',
            blockNumber: blockNumber,
          };
          saveTransaction(updatedTransaction, bankCode, user.address);

          // Cập nhật số dư sau khi rút tiền thành công
          if (user) {
            // Reload balance từ contract hoặc blockchain để đảm bảo chính xác
            try {
              // Thử load từ contract trước (nếu có)
              const contractDeployed = useContract !== null ? useContract : await isContractDeployed();
              if (contractDeployed) {
                const newBalance = await getContractBalance(user.address);
                if (newBalance !== null) {
                  setBalance(newBalance);
                  saveUserBalance(user.address, newBalance);
                  setIsRealBalance(true);
                }
              }
              
              // Fallback: load từ native blockchain balance (không phụ thuộc balance state)
              if (!contractDeployed || balance === null || balance === undefined) {
                try {
                  const nativeBalance = await getBalanceVND(user.address);
                  if (nativeBalance !== null) {
                    setBalance(nativeBalance);
                    saveUserBalance(user.address, nativeBalance);
                    setIsRealBalance(true);
                  }
                } catch (error) {
                  console.error('Error loading native balance:', error);
                }
              }
              
              // Final fallback: tính toán từ balance cũ (nếu vẫn chưa có)
              if (balance === null || balance === undefined) {
                const currentBalance = getStoredBalance(user.address);
                if (currentBalance !== null) {
                  const calculatedBalance = Math.max(0, currentBalance - amountNum);
                  setBalance(calculatedBalance);
                  saveUserBalance(user.address, calculatedBalance);
                }
              }
            } catch (error) {
              console.error('Error reloading balance after withdrawal:', error);
              // Fallback: tính toán từ balance cũ
              if (balance !== null) {
                const calculatedBalance = Math.max(0, balance - amountNum);
                setBalance(calculatedBalance);
                saveUserBalance(user.address, calculatedBalance);
              }
            }
          }

          // Hiển thị thông báo thành công với txHash
          setMessage({
            type: 'success',
            text: `Rút tiền thành công! Transaction Hash: ${txHash.substring(0, 10)}... Mã tham chiếu: ${refCode}.`,
          });

          // Reset form
          setAmount('');
          setAccountNumber('');
          setOtp('');
          setShowOtp(false);

          setTimeout(() => {
            router.push(`/bank/${bankCode}/history`);
          }, 3000);
        } else if (receipt && receipt.status === 0) {
          // Transaction failed on blockchain
          transactionStatus = 'failed';
          updateTransactionStatus(bankCode, user.address, txHash, 'failed');
          setMessage({
            type: 'error',
            text: 'Giao dịch rút tiền thất bại trên blockchain.',
          });
        } else {
          // Receipt is null - transaction chưa được confirm
          setMessage({
            type: 'error',
            text: 'Giao dịch đã được gửi nhưng chưa xác nhận. Vui lòng kiểm tra lại sau.',
          });
        }
      } catch (txError: any) {
        console.error('Withdrawal transaction error:', txError);
        setMessage({
          type: 'error',
          text: txError.message || 'Có lỗi xảy ra khi gửi giao dịch rút tiền',
        });
        setIsProcessing(false);
        return; // Return early on error
      }
    } catch (error: any) {
      console.error('Withdrawal error:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Có lỗi xảy ra khi rút tiền',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!user) {
    return <div className="text-gray-600">Đang tải...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Rút tiền</h2>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center space-x-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          <p>{message.text}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tài khoản
          </label>
          <div className="p-4 bg-gray-50 rounded-lg border-2 border-blue-200">
            <p className="font-medium text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-600 font-mono">{formatAddress(user.address)}</p>
            <p className="text-sm text-gray-600 mt-1">
              Số dư: {balance !== null ? formatVND(balance) : 'Đang tải...'}
              {!isRealBalance && balance !== null && (
                <span className="ml-2 text-xs text-yellow-600">(Ngoại tuyến)</span>
              )}
            </p>
            <p className="text-xs text-blue-600 mt-2">
              💡 Sử dụng dropdown ở trên để chọn user khác
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Số tiền (VND)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Nhập số tiền cần rút"
            min="0"
            step="1000"
            max={balance || undefined}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phương thức nhận tiền
          </label>
          <div className="p-4 border-2 border-blue-600 bg-blue-50 rounded-lg flex items-center space-x-3">
            <Banknote className="h-8 w-8 text-blue-600" />
            <div>
              <span className="font-medium text-gray-900">Rút tiền</span>
              <p className="text-sm text-gray-600">Rút tiền từ tài khoản</p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Số tài khoản nhận tiền (tùy chọn)
          </label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="Nhập số tài khoản"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {showOtp && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mã OTP
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Nhập mã OTP 6 chữ số"
              maxLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
        )}

        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={isProcessing}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                <span>{showOtp ? 'Xác nhận rút tiền' : 'Tiếp tục'}</span>
              </>
            )}
          </button>
          {showOtp && (
            <button
              type="button"
              onClick={() => {
                setShowOtp(false);
                setOtp('');
                setMessage(null);
              }}
              className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

