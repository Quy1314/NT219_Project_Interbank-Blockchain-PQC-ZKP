'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import {
  getTransactionsToSync,
  syncAllTransactionsToBlockchain,
  SyncResult,
} from '@/lib/syncTransactions';

export default function SyncTransactions() {
  const params = useParams();
  const bankCode = params.bankCode as string;

  const [transactionsToSync, setTransactionsToSync] = useState<
    Array<{
      transaction: any;
      bankCode: string;
      userAddress: string;
      privateKey: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentTxId: '' });

  useEffect(() => {
    loadTransactionsToSync();
  }, [bankCode]);

  const loadTransactionsToSync = () => {
    const transactions = getTransactionsToSync();
    setTransactionsToSync(transactions);
    setSyncResult(null);
  };

  const handleSync = async () => {
    if (transactionsToSync.length === 0) {
      alert('Không có giao dịch nào cần sync!');
      return;
    }

    if (
      !confirm(
        `Bạn có chắc chắn muốn sync ${transactionsToSync.length} giao dịch lên blockchain?\n\n` +
          'Lưu ý: Các giao dịch mock sẽ được gửi lại với transaction hash thật.'
      )
    ) {
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);
    setProgress({ current: 0, total: transactionsToSync.length, currentTxId: '' });

    try {
      const result = await syncAllTransactionsToBlockchain((current, total, txId) => {
        setProgress({ current, total, currentTxId: txId });
      });

      setSyncResult(result);
      loadTransactionsToSync(); // Reload to show updated transactions
    } catch (error: any) {
      console.error('Error syncing transactions:', error);
      alert(`Lỗi khi sync: ${error.message}`);
    } finally {
      setIsSyncing(false);
      setProgress({ current: 0, total: 0, currentTxId: '' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Đồng Bộ Giao Dịch Lên Blockchain</h1>
        <p className="text-gray-600">
          Sync các giao dịch đã hoàn tất từ LocalStorage lên blockchain Besu
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium">Tổng số cần sync</div>
          <div className="text-2xl font-bold text-blue-900">{transactionsToSync.length}</div>
        </div>
        {syncResult && (
          <>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm text-green-600 font-medium">Thành công</div>
              <div className="text-2xl font-bold text-green-900">{syncResult.success}</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm text-red-600 font-medium">Thất bại</div>
              <div className="text-2xl font-bold text-red-900">{syncResult.failed}</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-600 font-medium">Bỏ qua</div>
              <div className="text-2xl font-bold text-gray-900">{syncResult.skipped}</div>
            </div>
          </>
        )}
      </div>

      {/* Sync Button */}
      <div className="mb-6">
        <button
          onClick={handleSync}
          disabled={isSyncing || transactionsToSync.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSyncing ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>Đang sync... ({progress.current}/{progress.total})</span>
            </>
          ) : (
            <>
              <RefreshCw size={20} />
              <span>Sync Tất Cả Giao Dịch ({transactionsToSync.length})</span>
            </>
          )}
        </button>
        <button
          onClick={loadTransactionsToSync}
          disabled={isSyncing}
          className="ml-4 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Progress */}
      {isSyncing && progress.total > 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">
              Đang sync transaction: {progress.currentTxId}
            </span>
            <span className="text-sm text-blue-600">
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Sync Result */}
      {syncResult && !isSyncing && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            syncResult.failed === 0
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {syncResult.failed === 0 ? (
              <CheckCircle className="text-green-600 mt-1" size={24} />
            ) : (
              <AlertCircle className="text-yellow-600 mt-1" size={24} />
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">
                {syncResult.failed === 0
                  ? 'Sync hoàn tất thành công!'
                  : 'Sync hoàn tất với một số lỗi'}
              </h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>✅ Thành công: {syncResult.success}</li>
                <li>❌ Thất bại: {syncResult.failed}</li>
                <li>⏭️ Bỏ qua: {syncResult.skipped}</li>
              </ul>
              {syncResult.errors.length > 0 && (
                <div className="mt-3">
                  <p className="font-medium text-red-700 mb-2">Chi tiết lỗi:</p>
                  <ul className="text-sm text-red-600 space-y-1">
                    {syncResult.errors.map((err, idx) => (
                      <li key={idx}>
                        Transaction {err.txId}: {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transactions List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Danh Sách Giao Dịch Cần Sync ({transactionsToSync.length})
          </h2>
        </div>

        {transactionsToSync.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <CheckCircle size={48} className="mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium">Không có giao dịch nào cần sync!</p>
            <p className="text-sm mt-2">Tất cả giao dịch đã được sync lên blockchain.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {transactionsToSync.map((item, idx) => (
              <div key={idx} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                        Cần sync
                      </span>
                      <span className="text-sm text-gray-500">ID: {item.transaction.id}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Từ:</span>
                        <span className="ml-2 font-mono text-gray-900">
                          {item.transaction.from.slice(0, 10)}...
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Đến:</span>
                        <span className="ml-2 font-mono text-gray-900">
                          {item.transaction.to.slice(0, 10)}...
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Số tiền:</span>
                        <span className="ml-2 font-semibold text-gray-900">
                          {item.transaction.amount.toLocaleString('vi-VN')} VND
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Thời gian:</span>
                        <span className="ml-2 text-gray-900">
                          {new Date(item.transaction.timestamp).toLocaleString('vi-VN')}
                        </span>
                      </div>
                    </div>
                    {item.transaction.txHash && (
                      <div className="mt-2">
                        <span className="text-xs text-gray-500">Mock Hash:</span>
                        <span className="ml-2 text-xs font-mono text-gray-600">
                          {item.transaction.txHash}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

