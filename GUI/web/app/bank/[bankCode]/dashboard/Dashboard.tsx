'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Wallet, TrendingUp, Send, Clock, AlertCircle } from 'lucide-react';
import { getBankByCode, BankUser } from '@/config/banks';
import { getBalanceVND, formatAddress } from '@/lib/blockchain';
import { formatVND } from '@/config/blockchain';
import { getTransactionsByUser, getStoredBalance } from '@/lib/storage';
import { loadBalances, getBalanceForUser } from '@/lib/balances';
import { isContractDeployed, getContractBalance, listenToTransferEvents } from '@/lib/contract';

export default function Dashboard() {
  const params = useParams();
  const bankCode = params.bankCode as string;
  
  const [user, setUser] = useState<BankUser | null>(null);
  const [balance, setBalance] = useState<number | null>(null); // Start with null, load real balance
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useContract, setUseContract] = useState<boolean | null>(null);

  useEffect(() => {
    const bank = getBankByCode(bankCode);
    if (!bank) return;

    // Get selected user from localStorage
    const savedUserId = localStorage.getItem('interbank_selected_user');
    const selectedUser = bank.users.find((u) => u.id === savedUserId) || bank.users[0];
    setUser(selectedUser);

    // Check if contract is deployed
    checkContractStatus();

    // Load balance - load real balance, don't show fake default
    if (selectedUser) {
      // Load from file first (fast)
      loadBalanceFromFile(selectedUser.address);
      
      // Then try contract/blockchain to get real-time balance
      loadBalance(selectedUser.address);
    }

    // Set up event listener for contract events (if contract is deployed)
    let cleanupListener: (() => void) | undefined;
    
    const setupEventListener = async (userAddress: string) => {
      try {
        const deployed = await isContractDeployed();
        if (!deployed) return;

        // Listen to Transfer events
        const cleanup = listenToTransferEvents((event) => {
          // Only update if event involves current user
          if (
            event.from.toLowerCase() === userAddress.toLowerCase() ||
            event.to.toLowerCase() === userAddress.toLowerCase()
          ) {
            console.log('📢 Contract Transfer event received:', event);
            
            // Reload balance when transaction involves this user
            loadBalance(userAddress);
          }
        });

        return cleanup;
      } catch (error) {
        console.error('Error setting up event listener:', error);
        return undefined;
      }
    };

    if (selectedUser) {
      setupEventListener(selectedUser.address).then((cleanup) => {
        if (cleanup) {
          cleanupListener = cleanup;
        }
      });
    }

    // Cleanup listener on unmount or user change
    return () => {
      if (cleanupListener) {
        cleanupListener();
      }
    };
  }, [bankCode]);

  // Check if contract is deployed
  const checkContractStatus = async () => {
    try {
      const deployed = await isContractDeployed();
      setUseContract(deployed);
    } catch (error) {
      console.error('Error checking contract status:', error);
      setUseContract(false);
    }
  };

  // Load balance from file first (fast fallback)
  const loadBalanceFromFile = async (address: string) => {
    try {
      const fileBalance = await getBalanceForUser(address);
      if (fileBalance !== null && fileBalance >= 0) {
        setBalance(fileBalance);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error loading balance from file:', error);
      // Don't set fake balance, keep null if fails
    }
  };

  const loadBalance = async (address: string) => {
    console.log('🔄 loadBalance - Starting balance load for:', address);
    
    // 1. Ưu tiên: Kiểm tra LocalStorage (số dư mới nhất sau giao dịch)
    try {
      const storedBalance = getStoredBalance(address);
      if (storedBalance !== null) {
        console.log('💾 Loaded balance from LocalStorage:', storedBalance);
        setBalance(storedBalance);
        setIsLoading(false);
        // Vẫn tiếp tục load từ contract để cập nhật (nếu có)
      }
    } catch (error) {
      console.error('Error loading balance from storage:', error);
    }

    // 2. Thử lấy từ contract (kiểm tra trực tiếp, không cần useContract state)
    try {
      console.log('📋 Attempting to load balance from contract...');
      const contractBalance = await getContractBalance(address);
      if (contractBalance !== null && contractBalance >= 0) {
        console.log('✅ Loaded balance from contract:', contractBalance);
        setBalance(contractBalance);
        setIsLoading(false);
        // Update useContract state
        setUseContract(true);
        return;
      } else {
        console.log('⚠️ Contract balance is null or negative, trying native balance...');
      }
    } catch (error) {
      console.error('❌ Error loading balance from contract:', error);
      setUseContract(false);
    }

    // 3. Thử lấy từ Blockchain (native balance)
    try {
      console.log('📋 Attempting to load native balance...');
      const blockchainBalance = await getBalanceVND(address);
      if (blockchainBalance !== null && blockchainBalance >= 0) {
        console.log('✅ Loaded native balance:', blockchainBalance);
        setBalance(blockchainBalance);
        setIsLoading(false);
        return;
      }
    } catch (error) {
      console.error('❌ Error loading balance from blockchain:', error);
    }
    
    // 4. Nếu tất cả đều fail, giữ balance từ file hoặc LocalStorage (nếu đã load)
    console.log('⚠️ All balance sources failed, keeping existing balance');
    setIsLoading(false);
  };


  const transactions = user ? getTransactionsByUser(bankCode, user.address) : [];
  const recentTransactions = transactions.slice(0, 5);

  if (!user) {
    return <div className="text-gray-600">Đang tải...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Tổng quan</h2>

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-8 text-white mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 mb-2">Số dư tài khoản</p>
            <h3 className="text-4xl font-bold mb-2">
              {isLoading 
                ? 'Đang tải...' 
                : balance !== null 
                  ? formatVND(balance) 
                  : 'Không tải được'}
            </h3>
            <p className="text-blue-100 text-sm">
              {formatAddress(user.address)}
            </p>
            {error && (
              <div className="mt-2 flex items-center space-x-2 text-yellow-200 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
          </div>
          <Wallet className="h-16 w-16 text-blue-200" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <span className="text-2xl font-bold text-gray-900">
              {transactions.filter((t) => t.status === 'completed').length}
            </span>
          </div>
          <p className="text-gray-600">Giao dịch thành công</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <Send className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">
              {transactions.filter((t) => t.type === 'transfer').length}
            </span>
          </div>
          <p className="text-gray-600">Giao dịch chuyển tiền</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <Clock className="h-8 w-8 text-yellow-600" />
            <span className="text-2xl font-bold text-gray-900">
              {transactions.filter((t) => t.status === 'pending' || t.status === 'processing').length}
            </span>
          </div>
          <p className="text-gray-600">Giao dịch đang xử lý</p>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Giao dịch gần đây</h3>
        {recentTransactions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Chưa có giao dịch nào</p>
        ) : (
          <div className="space-y-4">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {tx.type === 'transfer' ? 'Chuyển tiền' : 'Rút tiền'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {tx.description || tx.referenceCode}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {tx.timestamp.toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="text-right">
                  {(() => {
                    // Phân biệt gửi tiền hay nhận tiền
                    const isSender = user && tx.from.toLowerCase() === user.address.toLowerCase();
                    const isReceiver = user && tx.to.toLowerCase() === user.address.toLowerCase();
                    const isOutgoing = tx.type === 'transfer' && isSender;
                    const isIncoming = tx.type === 'transfer' && isReceiver;
                    
                    return (
                      <p
                        className={`font-bold ${
                          isOutgoing || tx.type === 'withdrawal'
                            ? 'text-red-600' // Gửi tiền hoặc rút tiền (trừ tiền)
                            : 'text-green-600' // Nhận tiền (cộng tiền)
                        }`}
                      >
                        {isOutgoing || tx.type === 'withdrawal' ? '-' : '+'}
                        {formatVND(tx.amount)}
                      </p>
                    );
                  })()}
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs ${
                      tx.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : tx.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {tx.status === 'completed'
                      ? 'Hoàn tất'
                      : tx.status === 'pending'
                      ? 'Chờ xử lý'
                      : 'Đang xử lý'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

