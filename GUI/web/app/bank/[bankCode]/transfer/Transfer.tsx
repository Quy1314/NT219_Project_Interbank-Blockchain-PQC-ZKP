'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Send, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { getBankByCode, BankUser } from '@/config/banks';
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
  const [toAddress, setToAddress] = useState('');
  const [toBank, setToBank] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
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
    setToAddress('');
    setToBank('');
    setAmount('');
    setDescription('');
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

  const loadBalance = async (address: string) => {
    try {
      const storedBalance = getStoredBalance(address);
      if (storedBalance !== null) {
        setBalance(storedBalance);
        setIsRealBalance(MOCK_MODE);
      }
    } catch (error) {
      console.error('Error loading balance from storage:', error);
    }

    try {
      const contractBalance = await getContractBalance(address);
      if (contractBalance !== null && contractBalance >= 0) {
        setBalance(contractBalance);
        setIsRealBalance(true);
        setUseContract(true);
        return;
      }
    } catch (error) {
      console.error('Error loading balance from contract:', error);
      setUseContract(false);
    }

    try {
      const blockchainBalance = await getBalanceVND(address);
      if (blockchainBalance !== null && blockchainBalance >= 0) {
        setBalance(blockchainBalance);
        setIsRealBalance(true);
        return;
      }
    } catch (error) {
      console.error('Error loading balance from blockchain:', error);
    }

    try {
      const fileBalance = await getBalanceForUser(address);
      if (fileBalance !== null && fileBalance >= 0) {
        setBalance(fileBalance);
        setIsRealBalance(false);
      }
    } catch (error) {
      console.error('Error loading balance from file:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setMessage({ type: 'error', text: 'Vui lòng chọn người dùng' });
      return;
    }

    if (!toAddress || !toBank || !amount) {
      setMessage({ type: 'error', text: 'Vui lòng điền đầy đủ thông tin' });
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
          const result = await transferViaContract(
            user.privateKey,
            toAddress,
            amountNum,
            toBank,
            description || `Chuyển tiền đến ${toBank}`
          );

          updateTransactionStatus(
            bankCode,
            user.address,
            refCode,
            'completed',
            undefined,
            result.txHash
          );

          setMessage({
            type: 'success',
            text: `Chuyển tiền thành công! Tx Hash: ${result.txHash}`,
          });

          // Reload balance
          setTimeout(() => {
            loadBalance(user.address);
          }, 2000);
        } catch (error: any) {
          console.error('Transfer error:', error);
          updateTransactionStatus(bankCode, user.address, refCode, 'failed');
          
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
              Đến địa chỉ (Address)
            </label>
            <input
              type="text"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ngân hàng nhận
            </label>
            <select
              value={toBank}
              onChange={(e) => setToBank(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Chọn ngân hàng</option>
              <option value="VCB">Vietcombank</option>
              <option value="VTB">VietinBank</option>
              <option value="BIDV">BIDV</option>
              <option value="SBV">SBV</option>
            </select>
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
                <span>Chuyển tiền</span>
              </>
            )}
          </button>

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

