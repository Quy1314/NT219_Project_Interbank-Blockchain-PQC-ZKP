'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Search, ExternalLink, CheckCircle, Clock, XCircle, Trash2, AlertCircle, Copy, X, RefreshCw } from 'lucide-react';
import { getBankByCode, BankUser } from '@/config/banks';
import { formatAddress } from '@/lib/blockchain';
import { formatVND, getBlockchainExplorerUrl } from '@/config/blockchain';
import { getTransactionsByUser, deleteTransactionsByUser, deleteTransaction } from '@/lib/storage';
import { Transaction, TransactionType, TransactionStatus } from '@/types/transaction';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export default function History() {
  const params = useParams();
  const bankCode = params.bankCode as string;

  const [user, setUser] = useState<BankUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<{ from: string; to: string }>({
    from: '',
    to: '',
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const bank = getBankByCode(bankCode);
    if (!bank) return;

    const savedUserId = localStorage.getItem('interbank_selected_user');
    const selectedUser = bank.users.find((u) => u.id === savedUserId) || bank.users[0];
    setUser(selectedUser);
  }, [bankCode]);

  // Function to load transactions and remove duplicates
  const loadTransactions = () => {
    if (!user) return;
    
    setIsSyncing(true);
    try {
      const userTransactions = getTransactionsByUser(bankCode, user.address);
      
      // Remove duplicates based on id, from, to, timestamp, and txHash
      // Use a Map to track unique transactions
      const uniqueTransactionsMap = new Map<string, Transaction>();
      
      userTransactions.forEach((tx) => {
        // Create a unique key for this transaction
        const uniqueKey = `${tx.id}-${tx.from}-${tx.to}-${tx.timestamp.getTime()}-${tx.txHash || ''}`;
        
        // If we haven't seen this exact transaction, add it
        // If we have, prefer the one with more complete information (has txHash, blockNumber, etc.)
        if (!uniqueTransactionsMap.has(uniqueKey)) {
          uniqueTransactionsMap.set(uniqueKey, tx);
        } else {
          const existing = uniqueTransactionsMap.get(uniqueKey)!;
          // Prefer transaction with more complete info (txHash, blockNumber, completed status)
          if ((tx.txHash && !existing.txHash) || 
              (tx.blockNumber && !existing.blockNumber) ||
              (tx.status === 'completed' && existing.status !== 'completed')) {
            uniqueTransactionsMap.set(uniqueKey, tx);
          }
        }
      });
      
      // Convert Map values back to array and sort by timestamp (newest first)
      const uniqueTransactions = Array.from(uniqueTransactionsMap.values())
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      setTransactions(uniqueTransactions);
      setFilteredTransactions(uniqueTransactions);
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync every 5 seconds
  useEffect(() => {
    if (!user) return;

    // Initial load
    loadTransactions();

    // Set up interval to sync every 5 seconds
    const syncInterval = setInterval(() => {
      if (user) {
        loadTransactions(); // Use the same deduplication logic
      }
    }, 5000); // 5 seconds

    // Cleanup interval on unmount or user change
    return () => {
      clearInterval(syncInterval);
    };
  }, [bankCode, user]);

  useEffect(() => {
    let filtered = [...transactions];

    if (searchTerm) {
      filtered = filtered.filter(
        (tx) =>
          tx.referenceCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tx.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tx.from.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((tx) => tx.type === typeFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((tx) => tx.status === statusFilter);
    }

    if (dateFilter.from) {
      const fromDate = new Date(dateFilter.from);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((tx) => tx.timestamp >= fromDate);
    }
    if (dateFilter.to) {
      const toDate = new Date(dateFilter.to);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((tx) => tx.timestamp <= toDate);
    }

    setFilteredTransactions(filtered);
  }, [searchTerm, typeFilter, statusFilter, dateFilter, transactions]);

  const getStatusIcon = (status: TransactionStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'pending':
      case 'processing':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: TransactionStatus): string => {
    switch (status) {
      case 'completed':
        return 'Hoàn tất';
      case 'pending':
        return 'Chờ xử lý';
      case 'processing':
        return 'Đang xử lý';
      case 'failed':
        return 'Thất bại';
      default:
        return status;
    }
  };

  const handleDeleteAll = () => {
    if (user) {
      deleteTransactionsByUser(bankCode, user.address);
      setTransactions([]);
      setFilteredTransactions([]);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const handleDeleteTransaction = (transactionId: string) => {
    if (user) {
      deleteTransaction(bankCode, user.address, transactionId);
      const updated = getTransactionsByUser(bankCode, user.address);
      setTransactions(updated);
      setFilteredTransactions(updated);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const confirmDelete = (target: 'all' | string) => {
    setDeleteTarget(target);
    setShowDeleteConfirm(true);
  };

  if (!user) {
    return <div className="text-gray-600">Đang tải...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Lịch sử giao dịch</h2>
          <div className="flex items-center space-x-3 text-sm text-gray-500">
            <RefreshCw 
              className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} 
              title={isSyncing ? 'Đang đồng bộ...' : 'Tự động đồng bộ mỗi 5 giây'}
            />
            <span>
              {isSyncing ? 'Đang đồng bộ...' : `Cập nhật lúc: ${lastSyncTime.toLocaleTimeString('vi-VN')}`}
            </span>
          </div>
        </div>
        {transactions.length > 0 && (
          <button
            onClick={() => confirmDelete('all')}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="h-5 w-5" />
            <span>Xóa tất cả</span>
          </button>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Xác nhận xóa</h3>
            </div>
            <p className="text-gray-600 mb-6">
              {deleteTarget === 'all'
                ? 'Bạn có chắc chắn muốn xóa tất cả lịch sử giao dịch? Hành động này không thể hoàn tác.'
                : 'Bạn có chắc chắn muốn xóa giao dịch này?'}
            </p>
            <div className="flex space-x-4 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteTarget(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  if (deleteTarget === 'all') {
                    handleDeleteAll();
                  } else if (deleteTarget) {
                    handleDeleteTransaction(deleteTarget);
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TransactionType | 'all')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tất cả loại</option>
            <option value="transfer">Chuyển tiền</option>
            <option value="withdrawal">Rút tiền</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TransactionStatus | 'all')}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="completed">Hoàn tất</option>
            <option value="pending">Chờ xử lý</option>
            <option value="processing">Đang xử lý</option>
            <option value="failed">Thất bại</option>
          </select>

          <div className="flex space-x-2">
            <input
              type="date"
              value={dateFilter.from}
              onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value })}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="date"
              value={dateFilter.to}
              onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value })}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>Không tìm thấy giao dịch nào</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTransactions.map((tx, index) => (
              <div key={`${tx.id}-${tx.from}-${tx.to}-${tx.timestamp.getTime()}-${index}`} className="p-6 hover:bg-gray-50 transition-colors group">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(tx.status)}
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            tx.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : tx.status === 'pending' || tx.status === 'processing'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {getStatusText(tx.status)}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            tx.type === 'transfer'
                              ? user && tx.from.toLowerCase() === user.address.toLowerCase()
                                ? 'bg-red-100 text-red-700' // Gửi tiền
                                : 'bg-green-100 text-green-700' // Nhận tiền
                              : 'bg-purple-100 text-purple-700' // Rút tiền
                          }`}
                        >
                          {tx.type === 'transfer'
                            ? user && tx.from.toLowerCase() === user.address.toLowerCase()
                              ? 'Chuyển tiền đi'
                              : 'Nhận tiền'
                            : 'Rút tiền'}
                        </span>
                      </div>
                      <button
                        onClick={() => confirmDelete(tx.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Xóa giao dịch"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-gray-500">Mã tham chiếu</p>
                        <p className="font-medium text-gray-900">{tx.referenceCode}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Thời gian</p>
                        <p className="font-medium text-gray-900">
                          {format(tx.timestamp, 'dd/MM/yyyy HH:mm', { locale: vi })}
                        </p>
                      </div>
                      {tx.type === 'transfer' && (
                        <>
                          {user && tx.from.toLowerCase() === user.address.toLowerCase() ? (
                            // Gửi tiền đi - hiển thị người nhận
                            <div>
                              <p className="text-sm text-gray-500">Người nhận</p>
                              <p className="font-medium text-gray-900">{formatAddress(tx.to)}</p>
                            </div>
                          ) : (
                            // Nhận tiền - hiển thị người gửi
                            <div>
                              <p className="text-sm text-gray-500">Người gửi</p>
                              <p className="font-medium text-gray-900">{formatAddress(tx.from)}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-sm text-gray-500">Nội dung</p>
                            <p className="font-medium text-gray-900">
                              {tx.description || 'Không có'}
                            </p>
                          </div>
                        </>
                      )}
                      {tx.type === 'withdrawal' && (
                        <>
                          <div>
                            <p className="text-sm text-gray-500">Phương thức</p>
                            <p className="font-medium text-gray-900">ATM</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Nội dung</p>
                            <p className="font-medium text-gray-900">
                              {tx.description || 'Rút tiền tại ATM'}
                            </p>
                          </div>
                        </>
                      )}
                      {tx.txHash && (
                        <div>
                          <p className="text-sm text-gray-500">Transaction Hash</p>
                          <code className="text-xs font-mono text-gray-700 break-all">
                            {tx.txHash.substring(0, 20)}...
                          </code>
                        </div>
                      )}
                      {tx.blockNumber && (
                        <div>
                          <p className="text-sm text-gray-500">Block Number</p>
                          <p className="font-medium text-gray-900">{tx.blockNumber}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    {(() => {
                      // Phân biệt gửi tiền hay nhận tiền
                      const isSender = user && tx.from.toLowerCase() === user.address.toLowerCase();
                      const isReceiver = user && tx.to.toLowerCase() === user.address.toLowerCase();
                      const isOutgoing = tx.type === 'transfer' && isSender;
                      const isIncoming = tx.type === 'transfer' && isReceiver;
                      const isWithdrawal = tx.type === 'withdrawal';
                      
                      return (
                        <p
                          className={`text-2xl font-bold mb-2 ${
                            isOutgoing || isWithdrawal
                              ? 'text-red-600' // Gửi tiền hoặc rút tiền (trừ tiền)
                              : 'text-green-600' // Nhận tiền (cộng tiền)
                          }`}
                        >
                          {isOutgoing || isWithdrawal ? '-' : '+'}
                          {formatVND(tx.amount)}
                        </p>
                      );
                    })()}
                    {tx.txHash && (
                      <div className="space-y-2">
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                        >
                          <span>Chi tiết transaction</span>
                          <ExternalLink className="h-4 w-4" />
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(tx.txHash);
                              setCopied(tx.txHash);
                              setTimeout(() => setCopied(null), 2000);
                            } catch (err) {
                              console.error('Failed to copy:', err);
                            }
                          }}
                          className="text-xs text-gray-600 hover:text-gray-700 flex items-center space-x-1"
                        >
                          <Copy className="h-3 w-3" />
                          <span>{copied === tx.txHash ? 'Đã copy!' : 'Copy txHash'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Chi tiết Transaction</h3>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center space-x-2">
                  {getStatusIcon(selectedTx.status)}
                  <span className={`px-3 py-1 rounded text-sm font-medium ${
                    selectedTx.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : selectedTx.status === 'pending' || selectedTx.status === 'processing'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {getStatusText(selectedTx.status)}
                  </span>
                  <span className={`px-3 py-1 rounded text-sm font-medium ${
                    selectedTx.type === 'transfer'
                      ? user && selectedTx.from.toLowerCase() === user.address.toLowerCase()
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {selectedTx.type === 'transfer'
                      ? user && selectedTx.from.toLowerCase() === user.address.toLowerCase()
                        ? 'Chuyển tiền đi'
                        : 'Nhận tiền'
                      : 'Rút tiền'}
                  </span>
                </div>

                {/* Amount */}
                <div>
                  <p className="text-sm text-gray-500 mb-1">Số tiền</p>
                  <p className={`text-2xl font-bold ${
                    (user && selectedTx.from.toLowerCase() === user.address.toLowerCase()) || selectedTx.type === 'withdrawal'
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}>
                    {(user && selectedTx.from.toLowerCase() === user.address.toLowerCase()) || selectedTx.type === 'withdrawal' ? '-' : '+'}
                    {formatVND(selectedTx.amount)}
                  </p>
                </div>

                {/* Transaction Hash */}
                {selectedTx.txHash && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Transaction Hash</p>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 bg-gray-100 p-2 rounded text-sm font-mono break-all">
                        {selectedTx.txHash}
                      </code>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(selectedTx.txHash!);
                            setCopied(selectedTx.txHash!);
                            setTimeout(() => setCopied(null), 2000);
                          } catch (err) {
                            console.error('Failed to copy:', err);
                          }
                        }}
                        className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-1"
                      >
                        <Copy className="h-4 w-4" />
                        <span>{copied === selectedTx.txHash ? 'Đã copy!' : 'Copy'}</span>
                      </button>
                      <a
                        href={getBlockchainExplorerUrl('tx', selectedTx.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center space-x-1"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>Xem trên explorer</span>
                      </a>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      💡 Sử dụng txHash này để kiểm tra trên blockchain với script: 
                      <code className="ml-1 bg-gray-100 px-1 rounded">node scripts/public/check_transaction.js {selectedTx.txHash.substring(0, 20)}...</code>
                    </p>
                  </div>
                )}

                {/* Grid Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Mã tham chiếu</p>
                    <p className="font-medium">{selectedTx.referenceCode}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Thời gian</p>
                    <p className="font-medium">
                      {format(selectedTx.timestamp, 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                    </p>
                  </div>
                  {selectedTx.blockNumber && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Block Number</p>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium">{selectedTx.blockNumber}</p>
                        <a
                          href={getBlockchainExplorerUrl('block', selectedTx.blockNumber.toString())}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* From/To */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Từ</p>
                    <div className="flex items-center space-x-2">
                      <code className="font-mono text-sm">{formatAddress(selectedTx.from)}</code>
                      <a
                        href={getBlockchainExplorerUrl('address', selectedTx.from)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Đến</p>
                    <div className="flex items-center space-x-2">
                      <code className="font-mono text-sm">{formatAddress(selectedTx.to)}</code>
                      <a
                        href={getBlockchainExplorerUrl('address', selectedTx.to)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedTx.description && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Nội dung</p>
                    <p className="font-medium">{selectedTx.description}</p>
                  </div>
                )}

                {/* Withdrawal specific info */}
                {selectedTx.type === 'withdrawal' && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Phương thức rút tiền</p>
                    <p className="font-medium">ATM</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Tiền đã được trừ từ tài khoản và gửi đến địa chỉ withdrawal
                    </p>
                  </div>
                )}

                {/* Bank Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Ngân hàng gửi</p>
                    <p className="font-medium">{selectedTx.fromBank || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Ngân hàng nhận</p>
                    <p className="font-medium">{selectedTx.toBank || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

