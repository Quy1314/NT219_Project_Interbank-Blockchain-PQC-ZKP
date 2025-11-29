'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Send, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { getBankByCode, BankUser, BANKS, getAllUsers } from '@/config/banks';
import { sendTransaction, waitForTransaction, formatAddress, getBalanceVND } from '@/lib/blockchain';
import { formatVND, MOCK_MODE } from '@/config/blockchain';
import { getBalanceForUser } from '@/lib/balances';
import { saveTransaction, updateTransactionStatus, generateReferenceCode, saveUserBalance, getStoredBalance } from '@/lib/storage';
import { Transaction } from '@/types/transaction';
import { isContractDeployed, transferViaContract, getContractBalance, getContract } from '@/lib/contract';
import { getProvider } from '@/lib/blockchain';

export default function Transfer() {
  const params = useParams();
  const router = useRouter();
  const bankCode = params.bankCode as string;

  const [user, setUser] = useState<BankUser | null>(null);
  const [toAddress, setToAddress] = useState('');
  const [toBank, setToBank] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [balance, setBalance] = useState<number | null>(null); // Start with null, load real balance
  const [isRealBalance, setIsRealBalance] = useState(false); // Track if balance is from blockchain (real) or file (fallback)
  const [useContract, setUseContract] = useState<boolean | null>(null); // Track if using contract or native transfer

  const allUsers = getAllUsers();

  useEffect(() => {
    const bank = getBankByCode(bankCode);
    if (!bank) return;

    const savedUserId = localStorage.getItem('interbank_selected_user');
    const selectedUser = bank.users.find((u) => u.id === savedUserId) || bank.users[0];
    setUser(selectedUser);
    
    if (selectedUser) {
      // Check if contract is deployed
      checkContractStatus();
      loadBalance(selectedUser.address);
    }
  }, [bankCode]);

  // Check if contract is deployed
  const checkContractStatus = async () => {
    try {
      const deployed = await isContractDeployed();
      setUseContract(deployed);
      console.log(`Contract status: ${deployed ? 'Deployed - Using smart contract' : 'Not deployed - Using native transfer'}`);
    } catch (error) {
      console.error('Error checking contract status:', error);
      setUseContract(false);
    }
  };

  const loadBalance = async (address: string) => {
    console.log('🔄 Transfer - loadBalance - Starting balance load for:', address);
    setIsRealBalance(false); // Reset trước khi load

    // 1. Ưu tiên: Kiểm tra LocalStorage (số dư mới nhất sau giao dịch)
    try {
      const storedBalance = getStoredBalance(address);
      if (storedBalance !== null) {
        console.log('💾 Transfer - Loaded balance from LocalStorage:', storedBalance);
        setBalance(storedBalance);
        // Vẫn tiếp tục load từ contract để cập nhật (nếu có)
        setIsRealBalance(MOCK_MODE);
      }
    } catch (error) {
      console.error('Error loading balance from storage:', error);
    }

    // 2. Thử lấy từ contract (kiểm tra trực tiếp, không cần useContract state)
    try {
      console.log('📋 Transfer - Attempting to load balance from contract...');
      const contractBalance = await getContractBalance(address);
      if (contractBalance !== null && contractBalance >= 0) {
        console.log('✅ Transfer - Loaded balance from contract:', contractBalance);
        setBalance(contractBalance);
        setIsRealBalance(true); // Contract balance là số dư thật
        setUseContract(true); // Update useContract state
        return;
      } else {
        console.log('⚠️ Transfer - Contract balance is null or negative, trying native balance...');
      }
    } catch (error) {
      console.error('❌ Transfer - Error loading balance from contract:', error);
      setUseContract(false);
    }

    // 3. Thử lấy từ Blockchain (native balance)
    try {
      console.log('📋 Transfer - Attempting to load native balance...');
      const blockchainBalance = await getBalanceVND(address);
      if (blockchainBalance !== null && blockchainBalance >= 0) {
        console.log('✅ Transfer - Loaded native balance:', blockchainBalance);
        setBalance(blockchainBalance);
        setIsRealBalance(true); // Đánh dấu đây là số dư thật từ blockchain
        return;
      }
    } catch (error) {
      console.error('❌ Transfer - Error loading balance from blockchain:', error);
    }
    
    // 4. Nếu Blockchain lỗi, lấy từ File chỉ để HIỂN THỊ (không dùng để validate)
    try {
      const fileBalance = await getBalanceForUser(address);
      if (fileBalance !== null && fileBalance >= 0) {
        console.log('📄 Transfer - Loaded balance from file:', fileBalance, '(fallback only)');
        setBalance(fileBalance);
        setIsRealBalance(false); // Đánh dấu đây là số dư tham khảo (ảo) từ file
        return;
      }
    } catch (error) {
      console.error('Error loading balance from file:', error);
    }
    
    // Last resort: set to 0 if nothing works (coi 0 là số dư thật để chặn giao dịch)
    console.log('⚠️ Transfer - All balance sources failed, setting to 0');
    setBalance(0);
    setIsRealBalance(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setMessage({ type: 'error', text: 'Vui lòng chọn người dùng' });
      return;
    }

    if (!toAddress || !amount) {
      setMessage({ type: 'error', text: 'Vui lòng điền đầy đủ thông tin' });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setMessage({ type: 'error', text: 'Số tiền không hợp lệ' });
      return;
    }

    if (!showOtp) {
      // Generate OTP (mock - in production, send via SMS/email)
      const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setShowOtp(true);
      setMessage({ type: 'success', text: `Mã OTP: ${mockOtp} (Mock - dùng mã này để xác nhận)` });
      return;
    }

    // Verify OTP (mock - in production, verify with backend)
    if (otp.length !== 6) {
      setMessage({ type: 'error', text: 'Mã OTP không hợp lệ' });
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
      console.warn('⚠️ MOCK_MODE: Cho phép giao dịch với số dư ngoại tuyến');
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

    setIsProcessing(true);
    setMessage(null);

    try {
      // FIX LỖI 2 & 3: Tự động xác định bank thụ hưởng dựa trên địa chỉ cuối cùng
      let finalToBank = toBank;
      if (!finalToBank && toAddress) {
        const foundUser = allUsers.find(
          (u) => u.address.toLowerCase() === toAddress.toLowerCase()
        );
        if (foundUser) {
          finalToBank = foundUser.id.split('_')[0];
        } else {
          finalToBank = 'EXTERNAL'; // Đánh dấu là ví ngoài hệ thống
        }
      }

      const referenceCode = generateReferenceCode();
      const fee = 0; // Free in test network

      // Check balance before sending - only if balance is loaded and real
      if (balance !== null && balance >= 0 && amountNum > balance) {
        setMessage({
          type: 'error',
          text: `Số dư không đủ. Số dư hiện tại: ${formatVND(balance)}, Số tiền cần: ${formatVND(amountNum)}`,
        });
        setIsProcessing(false);
        return;
      }

      let txHash: string;
      let txId: bigint | null = null;
      let blockNumber: number | undefined;
      let transactionStatus: Transaction['status'] = 'pending';

      // Send transaction: Use contract if deployed, otherwise use native transfer
      // Check contract status trước khi transfer (đảm bảo useContract đã được set)
      const contractDeployed = useContract !== null ? useContract : await isContractDeployed();
      
      if (contractDeployed) {
        // Use smart contract transfer
        console.log('✅ Using smart contract for transfer...');
        console.log('🔍 Transfer - User address:', user.address);
        console.log('🔍 Transfer - User private key:', user.privateKey.substring(0, 10) + '...');
        console.log('🔍 Transfer - To address:', toAddress);
        console.log('🔍 Transfer - Amount VND:', amountNum);
        try {
          const contractResult = await transferViaContract(
            user.privateKey,
            toAddress,
            amountNum,
            finalToBank || 'EXTERNAL',
            description
          );
          txHash = contractResult.txHash;
          txId = contractResult.txId;
          
          // Contract transfer already waits for receipt, so transaction is confirmed
          const provider = getProvider();
          const receipt = await provider.getTransactionReceipt(txHash);
          if (receipt && receipt.status === 1) {
            blockNumber = receipt.blockNumber;
            transactionStatus = 'completed';
          } else if (receipt && receipt.status === 0) {
            transactionStatus = 'failed';
          }
        } catch (contractError: any) {
          console.error('Contract transfer error:', contractError);
          throw new Error(`Lỗi khi chuyển tiền qua contract: ${contractError.message}`);
        }
      } else {
        // Use native transfer (backward compatibility)
        console.log('⚠️ Using native transfer (contract not deployed)...');
        const txResponse = await sendTransaction(
          user.privateKey,
          toAddress,
          amountNum,
          description
        );
        txHash = txResponse.hash;
      }

      // Tạo transaction record SAU KHI đã có txHash
      // Description cho sender: giữ nguyên description từ input hoặc mặc định
      const senderDescription = description || `Chuyển tiền đến ${formatAddress(toAddress)}`;
      const transaction: Transaction = {
        id: txId ? `TX-${txId.toString()}` : referenceCode, // Use contract txId if available
        type: 'transfer',
        status: transactionStatus,
        from: user.address,
        to: toAddress,
        amount: amountNum,
        amountWei: '',
        fee,
        description: senderDescription, // Description cho sender
        referenceCode,
        timestamp: new Date(),
        fromBank: user.id.split('_')[0],
        toBank: finalToBank || 'EXTERNAL',
        txHash,
        blockNumber,
      };

      // Lưu transaction với đầy đủ thông tin (có txHash)
      saveTransaction(transaction, bankCode, user.address);
      if (blockNumber) {
        updateTransactionStatus(bankCode, user.address, txHash, transactionStatus, blockNumber);
      } else {
        updateTransactionStatus(bankCode, user.address, txHash, transactionStatus);
      }

      // Wait for confirmation (only for native transfer, contract already confirmed)
      if (!useContract) {
        try {
          const receipt = await waitForTransaction(txHash);
          if (receipt && receipt.status === 1) {
            // Transaction thành công
            transaction.status = 'completed';
            transaction.blockNumber = receipt.blockNumber;
            updateTransactionStatus(bankCode, user.address, txHash, 'completed', receipt.blockNumber);
            blockNumber = receipt.blockNumber;
            transactionStatus = 'completed';
          
          // Cập nhật số dư mới sau khi giao dịch thành công
          if (user && balance !== null) {
            const newBalance = Math.max(0, balance - amountNum); // Đảm bảo không âm
            saveUserBalance(user.address, newBalance); // Lưu vào LocalStorage
            setBalance(newBalance); // Cập nhật state ngay lập tức
            
            // Cập nhật số dư cho người nhận nếu họ trong hệ thống
            const receiver = allUsers.find(
              (u) => u.address.toLowerCase() === toAddress.toLowerCase()
            );
            if (receiver) {
              try {
                const receiverBalance = await getBalanceVND(receiver.address);
                const receiverStoredBalance = getStoredBalance(receiver.address);
                const receiverCurrentBalance = receiverBalance !== null ? receiverBalance : (receiverStoredBalance || 0);
                const receiverNewBalance = receiverCurrentBalance + amountNum;
                saveUserBalance(receiver.address, receiverNewBalance);
                
                // Tạo transaction record cho người nhận (native transfer)
                const receiverBank = BANKS.find((b) => 
                  b.users.some((u) => u.address.toLowerCase() === receiver.address.toLowerCase())
                );
                const receiverBankCode = receiverBank?.code || 'EXTERNAL';
                
                // Description cho receiver: khác với sender
                const receiverDescription = description 
                  ? `Nhận tiền từ ${user.name}: ${description}` 
                  : `Nhận tiền từ ${user.name}`;
                
                const receiverTransaction: Transaction = {
                  id: `${referenceCode}-RECEIVE`,
                  type: 'transfer',
                  status: 'completed',
                  from: user.address,
                  to: receiver.address,
                  amount: amountNum,
                  amountWei: '',
                  fee: 0,
                  description: receiverDescription, // Description riêng cho receiver
                  referenceCode: referenceCode,
                  timestamp: new Date(),
                  fromBank: user.id.split('_')[0],
                  toBank: receiverBankCode,
                  txHash,
                  blockNumber: receipt.blockNumber,
                };
                
                saveTransaction(receiverTransaction, receiverBankCode, receiver.address);
                console.log(`✅ Đã tạo transaction record cho người nhận (native transfer): ${receiver.address}`);
              } catch (error) {
                console.error('Error updating receiver balance:', error);
                // Nếu không lấy được balance của người nhận, tính toán dựa trên file
                const receiverFileBalance = await getBalanceForUser(receiver.address);
                if (receiverFileBalance !== null) {
                  const receiverNewBalance = receiverFileBalance + amountNum;
                  saveUserBalance(receiver.address, receiverNewBalance);
                }
              }
            }
          }
          
          setMessage({
            type: 'success',
            text: `Chuyển tiền thành công! Mã tham chiếu: ${referenceCode}`,
          });
          
          // Reset form
          setToAddress('');
          setAmount('');
          setDescription('');
          setOtp('');
          setShowOtp(false);
          
          // Redirect to history after 2 seconds
          setTimeout(() => {
            router.push(`/bank/${bankCode}/history`);
          }, 2000);
        } else if (receipt && receipt.status === 0) {
          // Transaction failed on blockchain
          transactionStatus = 'failed';
          updateTransactionStatus(bankCode, user.address, txHash, 'failed');
        } else {
          // Receipt is null - transaction chưa được confirm, keep as pending
        }
      } catch (waitError: any) {
        console.error('Error waiting for transaction:', waitError);
        // Nếu lỗi khi wait, giữ status là pending
      }
      }

      // Handle success/failure for both contract and native transfer
      if (transactionStatus === 'completed') {
        // Cập nhật số dư mới sau khi giao dịch thành công
        if (user && balance !== null) {
          if (useContract) {
            // Load balance từ contract
            try {
              const newBalance = await getContractBalance(user.address);
              if (newBalance !== null) {
                setBalance(newBalance);
                saveUserBalance(user.address, newBalance);
              }
            } catch (error) {
              console.error('Error loading balance from contract:', error);
              const newBalance = Math.max(0, balance - amountNum);
              setBalance(newBalance);
              saveUserBalance(user.address, newBalance);
            }
          } else {
            const newBalance = Math.max(0, balance - amountNum);
            setBalance(newBalance);
            saveUserBalance(user.address, newBalance);
          }
          
          // Cập nhật số dư và tạo transaction record cho người nhận nếu họ trong hệ thống
          const receiver = allUsers.find(
            (u) => u.address.toLowerCase() === toAddress.toLowerCase()
          );
          if (receiver) {
            try {
              // Tìm bankCode của receiver
              const receiverBank = BANKS.find((b) => 
                b.users.some((u) => u.address.toLowerCase() === receiver.address.toLowerCase())
              );
              const receiverBankCode = receiverBank?.code || 'EXTERNAL';

              // Cập nhật balance
              if (useContract) {
                const receiverBalance = await getContractBalance(receiver.address);
                if (receiverBalance !== null) {
                  saveUserBalance(receiver.address, receiverBalance);
                }
              } else {
                const receiverBalance = await getBalanceVND(receiver.address);
                const receiverStoredBalance = getStoredBalance(receiver.address);
                const receiverCurrentBalance = receiverBalance !== null ? receiverBalance : (receiverStoredBalance || 0);
                const receiverNewBalance = receiverCurrentBalance + amountNum;
                saveUserBalance(receiver.address, receiverNewBalance);
              }

              // Tạo transaction record cho người nhận (ghi nhận tiền vào)
              // Description cho receiver: khác với sender, thêm context về người gửi
              const receiverDescription = description 
                ? `Nhận tiền từ ${user.name}: ${description}` 
                : `Nhận tiền từ ${user.name}`;
              
              const receiverTransaction: Transaction = {
                id: txId ? `TX-${txId.toString()}-RECEIVE` : `${referenceCode}-RECEIVE`,
                type: 'transfer', // Cũng là type 'transfer' nhưng với vai trò là người nhận
                status: 'completed',
                from: user.address, // Người gửi
                to: receiver.address, // Người nhận
                amount: amountNum,
                amountWei: '',
                fee: 0,
                description: receiverDescription, // Description riêng cho receiver
                referenceCode: referenceCode, // Cùng reference code với sender
                timestamp: new Date(),
                fromBank: user.id.split('_')[0], // Bank của người gửi
                toBank: receiverBankCode, // Bank của người nhận
                txHash, // Cùng txHash với transaction của sender
                blockNumber,
              };

              // Lưu transaction vào lịch sử của người nhận
              saveTransaction(receiverTransaction, receiverBankCode, receiver.address);
              console.log(`✅ Đã tạo transaction record cho người nhận: ${receiver.address}`);
            } catch (error) {
              console.error('Error updating receiver balance and transaction:', error);
            }
          }
        }
        
        setMessage({
          type: 'success',
          text: `Chuyển tiền thành công! ${txId ? `Transaction ID: ${txId}` : `Mã tham chiếu: ${referenceCode}`}`,
        });
        
        // Reset form
        setToAddress('');
        setAmount('');
        setDescription('');
        setOtp('');
        setShowOtp(false);
        
        // Redirect to history after 2 seconds
        setTimeout(() => {
          router.push(`/bank/${bankCode}/history`);
        }, 2000);
      } else if (transactionStatus === 'failed') {
        setMessage({
          type: 'error',
          text: 'Giao dịch thất bại trên blockchain.',
        });
      } else {
        // Status is still pending
        setMessage({
          type: 'error',
          text: 'Giao dịch đã được gửi nhưng chưa xác nhận. Vui lòng kiểm tra lại sau.',
        });
      }
    } catch (error: any) {
      console.error('Transfer error:', error);
      setMessage({
        type: 'error',
        text: error.message || 'Có lỗi xảy ra khi chuyển tiền',
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
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Chuyển tiền</h2>

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
            Từ tài khoản
          </label>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="font-medium text-gray-900">{user.name}</p>
            <p className="text-sm text-gray-600">{formatAddress(user.address)}</p>
            <p className="text-sm text-gray-600 mt-1">
              Số dư: {balance !== null ? formatVND(balance) : 'Đang tải...'}
              {!isRealBalance && balance !== null && (
                <span className="ml-2 text-xs text-yellow-600">(Ngoại tuyến)</span>
              )}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Đến tài khoản
          </label>
          <select
            value={toAddress}
            onChange={(e) => {
              setToAddress(e.target.value);
              const selected = allUsers.find((u) => u.address === e.target.value);
              if (selected) {
                setToBank(selected.id.split('_')[0]);
              }
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Chọn người nhận</option>
            {allUsers
              .filter((u) => u.address !== user.address)
              .map((u) => (
                <option key={u.id} value={u.address}>
                  {u.name} ({formatAddress(u.address)}) - {BANKS.find((b) => b.users.includes(u))?.name}
                </option>
              ))}
          </select>
          <input
            type="text"
            value={toAddress}
            onChange={(e) => {
              const newAddress = e.target.value;
              setToAddress(newAddress);
              // FIX LỖI 3: Reset bank khi người dùng tự sửa địa chỉ
              setToBank('');
              
              // Auto-detect bank nếu địa chỉ match với user trong hệ thống
              if (newAddress) {
                const foundUser = allUsers.find(
                  (u) => u.address.toLowerCase() === newAddress.toLowerCase()
                );
                if (foundUser) {
                  setToBank(foundUser.id.split('_')[0]);
                }
              }
            }}
            placeholder="Hoặc nhập địa chỉ ví"
            className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Số tiền (VND)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Nhập số tiền"
            min="0"
            step="1000"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nội dung chuyển tiền
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Nhập nội dung (tùy chọn)"
            rows={3}
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
                <Send className="h-5 w-5" />
                <span>{showOtp ? 'Xác nhận chuyển tiền' : 'Tiếp tục'}</span>
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

