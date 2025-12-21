'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Wallet, TrendingUp, Send, Clock, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { animate } from 'animejs';
import { getBankByCode, BankUser } from '@/config/banks';
import { getBalanceVND, formatAddress } from '@/lib/blockchain';
import { formatVND } from '@/config/blockchain';
import { getTransactionsByUser, getStoredBalance } from '@/lib/storage';
import { loadBalances, getBalanceForUser } from '@/lib/balances';
import { isContractDeployed, getContractBalance, listenToTransferEvents } from '@/lib/contract';
import UserProfileCard from '@/components/UserProfileCard';
import UserIdentityCard from '@/components/UserIdentityCard';
import TransactionChart from '@/components/TransactionChart';

export default function Dashboard() {
  const params = useParams();
  const bankCode = params.bankCode as string;
  
  const [user, setUser] = useState<BankUser | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useContract, setUseContract] = useState<boolean | null>(null);
  
  // Animation refs
  const balanceRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const prevBalanceRef = useRef<number | null>(null);

  useEffect(() => {
    const bank = getBankByCode(bankCode);
    if (!bank) return;

    const loadUser = () => {
      const savedUserId = localStorage.getItem('interbank_selected_user');
      const selectedUser = bank.users.find((u) => u.id === savedUserId) || bank.users[0];
      setUser(selectedUser);
    };

    loadUser();
    checkContractStatus();

    // Listen for storage changes (when user changes in layout)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'interbank_selected_user') {
        loadUser();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom event (for same-window changes)
    const handleUserChange = () => {
      loadUser();
    };
    window.addEventListener('userChanged', handleUserChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userChanged', handleUserChange);
    };
  }, [bankCode]);

  // Reload balance and setup event listener when user changes
  useEffect(() => {
    if (!user) return;

    // Reload balance when user changes
    loadBalanceFromFile(user.address);
    loadBalance(user.address);

    let cleanupListener: (() => void) | undefined;
    
    const setupEventListener = async (userAddress: string) => {
      try {
        const deployed = await isContractDeployed();
        if (!deployed) return;

        const cleanup = listenToTransferEvents((event) => {
          if (
            event.from.toLowerCase() === userAddress.toLowerCase() ||
            event.to.toLowerCase() === userAddress.toLowerCase()
          ) {
            console.log('📢 Contract Transfer event received:', event);
            loadBalance(userAddress);
          }
        });

        return cleanup;
      } catch (error) {
        console.error('Error setting up event listener:', error);
        return undefined;
      }
    };

    setupEventListener(user.address).then((cleanup) => {
      if (cleanup) {
        cleanupListener = cleanup;
      }
    });

    return () => {
      if (cleanupListener) {
        cleanupListener();
      }
    };
  }, [user?.address, bankCode]);

  const checkContractStatus = async () => {
    try {
      const deployed = await isContractDeployed();
      setUseContract(deployed);
    } catch (error) {
      console.error('Error checking contract status:', error);
      setUseContract(false);
    }
  };

  const loadBalanceFromFile = async (address: string) => {
    try {
      const fileBalance = await getBalanceForUser(address);
      if (fileBalance !== null && fileBalance >= 0) {
        setBalance(fileBalance);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error loading balance from file:', error);
    }
  };

  const loadBalance = async (address: string) => {
    console.log('🔄 loadBalance - Starting balance load for:', address);
    
    try {
      const storedBalance = getStoredBalance(address);
      if (storedBalance !== null) {
        console.log('💾 Loaded balance from LocalStorage:', storedBalance);
        setBalance(storedBalance);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error loading balance from storage:', error);
    }

    try {
      console.log('📋 Attempting to load balance from contract...');
      const contractBalance = await getContractBalance(address);
      if (contractBalance !== null && contractBalance >= 0) {
        console.log('✅ Loaded balance from contract:', contractBalance);
        setBalance(contractBalance);
        setIsLoading(false);
        setUseContract(true);
        return;
      } else {
        console.log('⚠️ Contract balance is null or negative, trying native balance...');
      }
    } catch (error) {
      console.error('❌ Error loading balance from contract:', error);
      setUseContract(false);
    }

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
    
    console.log('⚠️ All balance sources failed, keeping existing balance');
    setIsLoading(false);
  };

  const transactions = user ? getTransactionsByUser(bankCode, user.address) : [];
  const recentTransactions = transactions.slice(0, 5);
  
  // Calculate stats
  const completedTxs = transactions.filter((t) => t.status === 'completed');
  const pendingTxs = transactions.filter((t) => t.status === 'pending' || t.status === 'processing');
  const sentTxs = transactions.filter((t) => 
    t.type === 'transfer' && 
    user && 
    t.from.toLowerCase() === user.address.toLowerCase()
  );
  const receivedTxs = transactions.filter((t) => 
    t.type === 'transfer' && 
    user && 
    t.to.toLowerCase() === user.address.toLowerCase()
  );

  if (!user) {
    return <div className="text-gray-600">Đang tải...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
        </div>
      </div>

      {/* Top Row: Balance + PKI Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance Card - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Wallet className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-emerald-100 text-sm">Số dư tài khoản</p>
                    <p className="text-white/90 text-sm font-semibold">{user.fullName || user.name}</p>
                    <p className="text-white/60 text-xs font-mono mt-0.5">{formatAddress(user.address)}</p>
                  </div>
                </div>
                <ArrowUpRight className="h-6 w-6 text-emerald-200" />
              </div>
              
              <div className="mb-4">
                <h3 ref={balanceRef} className="text-5xl font-bold tracking-tight">
                  {isLoading 
                    ? 'Đang tải...' 
                    : balance !== null 
                      ? formatVND(balance) 
                      : 'Không tải được'}
                </h3>
              </div>

              {error && (
                <div className="flex items-center space-x-2 text-yellow-200 text-sm bg-yellow-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/20">
                <div>
                  <div className="flex items-center space-x-2 text-emerald-100 text-sm mb-1">
                    <ArrowUpRight className="h-4 w-4" />
                    <span>Sent</span>
                  </div>
                  <p className="text-2xl font-bold">{sentTxs.length}</p>
                </div>
                <div>
                  <div className="flex items-center space-x-2 text-emerald-100 text-sm mb-1">
                    <ArrowDownRight className="h-4 w-4" />
                    <span>Received</span>
                  </div>
                  <p className="text-2xl font-bold">{receivedTxs.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PKI Profile Card */}
        <div className="lg:col-span-1">
          <UserProfileCard userAddress={user.address} />
        </div>
      </div>

      {/* User Identity Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UserIdentityCard user={user} />
      </div>

      {/* Stats Cards */}
      <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card-animate bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
            <ArrowUpRight className="h-5 w-5 text-green-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {completedTxs.length}
          </div>
          <p className="text-gray-600 text-sm">Completed</p>
          <p className="text-xs text-green-600 mt-2">+{completedTxs.length} from last month</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Send className="h-6 w-6 text-blue-600" />
            </div>
            <ArrowUpRight className="h-5 w-5 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {sentTxs.length}
          </div>
          <p className="text-gray-600 text-sm">Transfers</p>
          <p className="text-xs text-blue-600 mt-2">Outgoing</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <ArrowDownRight className="h-6 w-6 text-purple-600" />
            </div>
            <ArrowUpRight className="h-5 w-5 text-purple-500" />
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {receivedTxs.length}
          </div>
          <p className="text-gray-600 text-sm">Received</p>
          <p className="text-xs text-purple-600 mt-2">Incoming</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <span className="text-yellow-600 text-sm">On Discuss</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {pendingTxs.length}
          </div>
          <p className="text-gray-600 text-sm">Pending</p>
        </div>
      </div>

      {/* Transaction Chart */}
      <TransactionChart transactions={transactions} userAddress={user.address} />

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Giao dịch gần đây</h3>
          <button className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            View All →
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-500">Chưa có giao dịch nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentTransactions.map((tx, index) => {
              const isSender = user && tx.from.toLowerCase() === user.address.toLowerCase();
              const isOutgoing = tx.type === 'transfer' && isSender;
              
              // Create unique key by combining id, timestamp, and index
              const uniqueKey = `${tx.id}-${tx.timestamp.getTime()}-${index}-${tx.txHash || ''}`;
              
              return (
                <div
                  key={uniqueKey}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isOutgoing || tx.type === 'withdrawal'
                        ? 'bg-red-100'
                        : 'bg-green-100'
                    }`}>
                      {isOutgoing || tx.type === 'withdrawal' ? (
                        <ArrowUpRight className={`h-5 w-5 text-red-600`} />
                      ) : (
                        <ArrowDownRight className={`h-5 w-5 text-green-600`} />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {tx.type === 'transfer' ? 'Chuyển tiền' : 'Rút tiền'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {tx.description || tx.referenceCode}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {tx.timestamp.toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className={`font-bold text-lg ${
                      isOutgoing || tx.type === 'withdrawal'
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}>
                      {isOutgoing || tx.type === 'withdrawal' ? '-' : '+'}
                      {formatVND(tx.amount)}
                    </p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      tx.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : tx.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {tx.status === 'completed'
                        ? 'Completed'
                        : tx.status === 'pending'
                        ? 'Pending'
                        : 'In Progress'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
