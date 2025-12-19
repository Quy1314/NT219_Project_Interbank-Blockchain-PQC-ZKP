'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Send, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { getBankByCode, BankUser, getAllUsers, BANKS } from '@/config/banks';
import { formatVND, MOCK_MODE } from '@/config/blockchain';
import { formatAddress, getBalanceVND, getWallet, sendTransaction, waitForTransaction } from '@/lib/blockchain';
import { getBalanceForUser } from '@/lib/balances';
import { isContractDeployed, getContractBalance, transferViaContract } from '@/lib/contract';
import { saveTransaction, generateReferenceCode, updateTransactionStatus, saveUserBalance, getStoredBalance } from '@/lib/storage';
import { Transaction } from '@/types/transaction';
import UserSelector from '@/components/UserSelector';

export default function Transfer() {
  const params = useParams();
  const router = useRouter();
  const bankCode = params.bankCode as string;

  const [user, setUser] = useState<BankUser | null>(null);
  const [toUser, setToUser] = useState<BankUser | null>(null);
  const [toAddress, setToAddress] = useState('');
  const [toBank, setToBank] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [referenceCode, setReferenceCode] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [isRealBalance, setIsRealBalance] = useState(false);
  const [useContract, setUseContract] = useState<boolean | null>(null);

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

  const handleUserChange = (newUser: BankUser) => {
    setUser(newUser);
    localStorage.setItem('interbank_selected_user', newUser.id);
    checkContractStatus();
    loadBalance(newUser.address);
    // Reset form when user changes
    setToUser(null);
    setToAddress('');
    setToBank('');
    setAmount('');
    setDescription('');
    setOtp('');
    setShowOtp(false);
    setGeneratedOtp(null);
    setMessage(null);
  };

  const checkContractStatus = async () => {
    try {
      const deployed = await isContractDeployed();
      setUseContract(deployed);
    } catch (error) {
      console.error('Error checking contract status:', error);
      setUseContract(false);
    }
  };

  const loadBalance = async (address: string, forceRefresh: boolean = false) => {
    console.log('🔄 Loading balance for:', address, 'forceRefresh:', forceRefresh);
    
    // If force refresh, skip stored balance
    if (!forceRefresh) {
      try {
        const storedBalance = getStoredBalance(address);
        if (storedBalance !== null) {
          setBalance(storedBalance);
          setIsRealBalance(MOCK_MODE);
        }
      } catch (error) {
        console.error('Error loading balance from storage:', error);
      }
    }

    // Always try to get contract balance first (most accurate)
    try {
      console.log('🔍 Fetching contract balance...');
      const contractBalance = await getContractBalance(address);
      if (contractBalance !== null && contractBalance >= 0) {
        console.log('✅ Contract balance:', contractBalance);
        setBalance(contractBalance);
        setIsRealBalance(true);
        setUseContract(true);
        // Update stored balance
        saveUserBalance(address, contractBalance);
        return;
      }
    } catch (error) {
      console.error('Error loading balance from contract:', error);
      setUseContract(false);
    }

    // Fallback to native blockchain balance
    try {
      console.log('🔍 Fetching native blockchain balance...');
      const blockchainBalance = await getBalanceVND(address);
      if (blockchainBalance !== null && blockchainBalance >= 0) {
        console.log('✅ Native balance:', blockchainBalance);
        setBalance(blockchainBalance);
        setIsRealBalance(true);
        // Update stored balance
        saveUserBalance(address, blockchainBalance);
        return;
      }
    } catch (error) {
      console.error('Error loading balance from blockchain:', error);
    }

    // Final fallback: file balance
    if (!forceRefresh) {
      try {
        const fileBalance = await getBalanceForUser(address);
        if (fileBalance !== null && fileBalance >= 0) {
          setBalance(fileBalance);
          setIsRealBalance(false);
        }
      } catch (error) {
        console.error('Error loading balance from file:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setMessage({ type: 'error', text: 'Vui lòng chọn người dùng' });
      return;
    }

    if (!toUser || !toAddress || !toBank || !amount) {
      setMessage({ type: 'error', text: 'Vui lòng chọn người nhận và điền đầy đủ thông tin' });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setMessage({ type: 'error', text: 'Số tiền không hợp lệ' });
      return;
    }

    if (balance === null || amountNum > balance) {
      setMessage({
        type: 'error',
        text: `Số dư không đủ. Số dư hiện tại: ${balance !== null ? formatVND(balance) : 'Không xác định'}, Số tiền cần: ${formatVND(amountNum)}`,
      });
      return;
    }

    // OTP validation step
    if (!showOtp) {
      // Generate new OTP (mock) - generate fresh OTP each time
      const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(mockOtp); // Store generated OTP for validation
      setShowOtp(true);
      setOtp(''); // Clear any previous OTP input
      setMessage({ type: 'success', text: `Mã OTP: ${mockOtp} (Mock - dùng mã này để xác nhận)` });
      return;
    }

    // Validate OTP - check if OTP is provided and matches generated OTP
    if (!otp || otp.length !== 6) {
      setMessage({ type: 'error', text: 'Mã OTP không hợp lệ. Vui lòng nhập 6 chữ số' });
      return;
    }

    // Check if OTP matches the generated OTP
    if (!generatedOtp || otp !== generatedOtp) {
      setMessage({ type: 'error', text: 'Mã OTP không đúng. Vui lòng nhập lại mã OTP đã được gửi.' });
      setOtp(''); // Clear incorrect OTP
      return;
    }

    // OTP is valid, invalidate it immediately to prevent reuse
    setGeneratedOtp(null);

    setIsProcessing(true);
    setMessage(null);

    try {
      const refCode = generateReferenceCode();
      setReferenceCode(refCode);

      const transaction: Transaction = {
        id: refCode,
        type: 'transfer',
        status: 'pending',
        from: user.address,
        to: toAddress,
        amount: amountNum,
        amountWei: '',
        fee: 0,
        description: description || `Chuyển tiền đến ${toBank}`,
        referenceCode: refCode,
        timestamp: new Date(),
        fromBank: bankCode,
        toBank: toBank,
      };

      saveTransaction(transaction, bankCode, user.address);

      if (useContract) {
        try {
          console.log('🚀 Starting contract transfer...');
          
          // Show immediate notification that transaction is being sent
          setMessage({
            type: 'success',
            text: 'Đang gửi transaction...',
          });
          
          const result = await transferViaContract(
            user.privateKey,
            toAddress,
            amountNum,
            toBank,
            description || `Chuyển tiền đến ${toBank}`
          );

          console.log('✅ Transfer result:', result);
          console.log('✅ Transfer result type:', typeof result);
          console.log('✅ Transfer result keys:', result ? Object.keys(result) : 'null');
          console.log('✅ Transfer result.txHash:', result?.txHash);
          console.log('✅ Transfer result.txHash type:', typeof result?.txHash);

          if (!result) {
            throw new Error('Transaction không trả về kết quả. Có thể transaction đã thất bại.');
          }

          if (!result.txHash) {
            console.error('❌ Transaction hash is undefined!');
            console.error('Full result object:', JSON.stringify(result, null, 2));
            throw new Error('Transaction không trả về hash. Có thể transaction đã thất bại. Vui lòng kiểm tra console logs.');
          }

          // Ensure txHash is a string
          const txHashString = String(result.txHash);
          console.log('✅ Transaction hash (string):', txHashString);

          // Update transaction status immediately with txHash
          updateTransactionStatus(
            bankCode,
            user.address,
            refCode,
            'processing', // Set to processing first, will be updated to completed when receipt confirms
            undefined,
            txHashString
          );

          console.log('✅ Transaction status updated with hash:', txHashString);

          // Show success message immediately with txHash (like GitHub repo)
          const shortHash = txHashString.length > 10 ? txHashString.substring(0, 10) + '...' : txHashString;
          setMessage({
            type: 'success',
            text: `Chuyển tiền thành công! Transaction Hash: ${shortHash} Mã tham chiếu: ${refCode}`,
          });

          // Clear form
          setAmount('');
          setDescription('');
          setOtp('');
          setShowOtp(false);
          setGeneratedOtp(null); // Invalidate OTP after successful transfer

          // Update status to completed in background (after receipt confirmation)
          // Note: This is handled by the contract function which waits for receipt
          setTimeout(() => {
            updateTransactionStatus(
              bankCode,
              user.address,
              refCode,
              'completed',
              undefined,
              result.txHash
            );
          }, 2000);

          // Force reload balance immediately (skip cache)
          console.log('🔄 Force reloading balance immediately...');
          await loadBalance(user.address, true);
          
          // Retry after 1 second with force refresh
          setTimeout(async () => {
            console.log('🔄 Retrying balance reload (1s) with force refresh...');
            await loadBalance(user.address, true);
          }, 1000);
          
          // Retry after 2 seconds with force refresh
          setTimeout(async () => {
            console.log('🔄 Retrying balance reload (2s) with force refresh...');
            await loadBalance(user.address, true);
          }, 2000);
          
          // Retry after 3 seconds with force refresh
          setTimeout(async () => {
            console.log('🔄 Retrying balance reload (3s) with force refresh...');
            await loadBalance(user.address, true);
          }, 3000);
          
          // Final retry after 5 seconds
          setTimeout(async () => {
            console.log('🔄 Final balance reload (5s) with force refresh...');
            await loadBalance(user.address, true);
          }, 5000);
        } catch (error: any) {
          console.error('Transfer error:', error);
          updateTransactionStatus(bankCode, user.address, refCode, 'failed');
          
          // Invalidate OTP on error to prevent reuse
          setGeneratedOtp(null);
          setOtp('');
          setShowOtp(false);
          
          let errorMessage = error.message || 'Lỗi không xác định';
          
          // Check for PKI-related errors
          if (errorMessage.includes('User not registered') || 
              errorMessage.includes('not registered in PKI')) {
            errorMessage = 'Người dùng chưa được đăng ký trong PKI Registry. Vui lòng đăng ký trước khi chuyển tiền.';
          } else if (errorMessage.includes('KYC') || errorMessage.includes('KYC not valid')) {
            errorMessage = 'KYC chưa được xác minh hoặc đã hết hạn. Vui lòng liên hệ ngân hàng để xác minh KYC.';
          } else if (errorMessage.includes('not authorized') || errorMessage.includes('Transfer not authorized')) {
            errorMessage = 'Bạn chưa được cấp quyền chuyển tiền hoặc đã vượt quá giới hạn chuyển tiền hàng ngày.';
          } else if (errorMessage.includes('daily limit') || errorMessage.includes('Daily limit')) {
            errorMessage = 'Đã vượt quá giới hạn chuyển tiền hàng ngày. Vui lòng thử lại vào ngày mai.';
          }
          
          setMessage({
            type: 'error',
            text: `Chuyển tiền thất bại: ${errorMessage}`,
          });
        }
      } else {
        // Fallback to native transfer (if contract not deployed)
        const tx = await sendTransaction(user.privateKey, toAddress, amountNum, description);
        const receipt = await waitForTransaction(tx.hash);
        
        if (receipt && receipt.status === 1) {
          updateTransactionStatus(bankCode, user.address, refCode, 'completed', receipt.blockNumber, receipt.transactionHash);
          setMessage({
            type: 'success',
            text: `Chuyển tiền thành công! Tx Hash: ${receipt.transactionHash}`,
          });
        } else {
          updateTransactionStatus(bankCode, user.address, refCode, 'failed');
          setMessage({
            type: 'error',
            text: 'Chuyển tiền thất bại',
          });
        }
      }
    } catch (error: any) {
      console.error('Transfer error:', error);
      setMessage({
        type: 'error',
        text: `Lỗi: ${error.message || 'Không xác định'}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const bank = getBankByCode(bankCode);
  if (!bank || !user) {
    return <div className="text-gray-600">Đang tải...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Chuyển tiền</h1>
          <UserSelector bank={bank} selectedUser={user} onSelectUser={handleUserChange} />
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center space-x-2 ${
              message.type === 'success'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
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

        <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Từ tài khoản
            </label>
            <div className="p-4 bg-gray-50 rounded-lg border-2 border-blue-200">
              <p className="font-medium text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-600 font-mono">{formatAddress(user.address)}</p>
              <p className="text-sm text-gray-600 mt-1">
                Số dư: {balance !== null ? formatVND(balance) : 'Đang tải...'}
              </p>
              <p className="text-xs text-blue-600 mt-2">
                💡 Sử dụng dropdown ở trên để chọn user khác
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chọn người nhận
            </label>
            <select
              value={toUser ? `${toUser.id}` : ''}
              onChange={(e) => {
                const selectedUserId = e.target.value;
                if (selectedUserId) {
                  const allUsers = getAllUsers();
                  const selectedUser = allUsers.find(u => u.id === selectedUserId);
                  if (selectedUser) {
                    setToUser(selectedUser);
                    setToAddress(selectedUser.address);
                    // Tìm bank code từ user
                    const userBank = BANKS.find(bank => 
                      bank.users.some(u => u.id === selectedUser.id)
                    );
                    if (userBank) {
                      setToBank(userBank.code);
                    }
                  }
                } else {
                  setToUser(null);
                  setToAddress('');
                  setToBank('');
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Chọn người nhận</option>
              {getAllUsers()
                .filter(u => u.id !== user?.id) // Loại bỏ user hiện tại
                .map((u) => {
                  const userBank = BANKS.find(bank => 
                    bank.users.some(user => user.id === u.id)
                  );
                  return (
                    <option key={u.id} value={u.id}>
                      {u.name} ({userBank?.name || 'Unknown'}) - {formatAddress(u.address)}
                    </option>
                  );
                })}
            </select>
            {toUser && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-gray-900">{toUser.name}</p>
                <p className="text-xs text-gray-600 font-mono mt-1">{toAddress}</p>
                <p className="text-xs text-blue-600 mt-1">Ngân hàng: {toBank}</p>
              </div>
            )}
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
              max={balance || undefined}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mô tả (tùy chọn)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nội dung chuyển tiền"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={6}
                required
              />
              <p className="mt-2 text-sm text-gray-600">
                Mã OTP đã được gửi (Mock). Vui lòng nhập mã OTP để xác nhận chuyển tiền.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isProcessing || balance === null || balance === 0}
            className="w-full bg-emerald-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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
                setGeneratedOtp(null); // Clear generated OTP when canceling
                setMessage(null);
              }}
              className="mt-2 w-full text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Hủy và quay lại
            </button>
          )}

          {useContract && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
              <AlertCircle className="h-4 w-4 inline mr-2" />
              Đang sử dụng Smart Contract với PKI verification
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

