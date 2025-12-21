'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Download, Filter, Search, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { getBankByCode, BankUser } from '@/config/banks';
import { formatAddress } from '@/lib/blockchain';
import { 
  loadAuditLogs, 
  queryAuditLogs, 
  exportAuditLogs, 
  getAuditStatistics,
  AuditAction,
  AuditResult,
  AuditLogEntry
} from '@/lib/audit';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export default function AuditLogs() {
  const params = useParams();
  const bankCode = params.bankCode as string;

  const [user, setUser] = useState<BankUser | null>(null);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');
  const [resultFilter, setResultFilter] = useState<AuditResult | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<{ from: string; to: string }>({
    from: '',
    to: '',
  });
  const [statistics, setStatistics] = useState<ReturnType<typeof getAuditStatistics> | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    const bank = getBankByCode(bankCode);
    if (!bank) return;

    const savedUserId = localStorage.getItem('interbank_selected_user');
    const selectedUser = bank.users.find((u) => u.id === savedUserId) || bank.users[0];
    setUser(selectedUser);
  }, [bankCode]);

  useEffect(() => {
    if (user) {
      loadLogs();
      loadStatistics();
    }
  }, [user?.address, bankCode]);

  const loadLogs = () => {
    if (!user) return;
    
    // Load logs for current user
    const userLogs = queryAuditLogs({
      actor: user.address,
      limit: 1000, // Load last 1000 logs
    });
    
    setLogs(userLogs);
    setFilteredLogs(userLogs);
  };

  const loadStatistics = () => {
    const stats = getAuditStatistics();
    setStatistics(stats);
  };

  useEffect(() => {
    let filtered = [...logs];

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter((log) => {
        const searchLower = searchTerm.toLowerCase();
        return (
          log.action.toLowerCase().includes(searchLower) ||
          log.actor.address.toLowerCase().includes(searchLower) ||
          log.target?.address?.toLowerCase().includes(searchLower) ||
          log.txHash?.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.details).toLowerCase().includes(searchLower)
        );
      });
    }

    // Filter by action
    if (actionFilter !== 'all') {
      filtered = filtered.filter((log) => log.action === actionFilter);
    }

    // Filter by result
    if (resultFilter !== 'all') {
      filtered = filtered.filter((log) => log.result === resultFilter);
    }

    // Filter by date
    if (dateFilter.from) {
      const fromDate = new Date(dateFilter.from);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((log) => new Date(log.timestamp) >= fromDate);
    }

    if (dateFilter.to) {
      const toDate = new Date(dateFilter.to);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((log) => new Date(log.timestamp) <= toDate);
    }

    setFilteredLogs(filtered);
  }, [searchTerm, actionFilter, resultFilter, dateFilter, logs]);

  const getActionLabel = (action: AuditAction): string => {
    const labels: Record<AuditAction, string> = {
      PKI_REGISTER: 'Đăng ký PKI',
      PKI_KEY_ROTATION: 'Xoay khóa PKI',
      KYC_VERIFY: 'Xác minh KYC',
      KYC_REVOKE: 'Thu hồi KYC',
      AUTHORIZATION_SET: 'Thiết lập quyền',
      AUTHORIZATION_REVOKE: 'Thu hồi quyền',
      TRANSFER: 'Chuyển tiền',
      TRANSFER_FAILED: 'Chuyển tiền thất bại',
      WITHDRAWAL: 'Rút tiền',
      WITHDRAWAL_FAILED: 'Rút tiền thất bại',
      DEPOSIT: 'Nạp tiền',
      BALANCE_CHANGE: 'Thay đổi số dư',
      USER_LOGIN: 'Đăng nhập',
      USER_LOGOUT: 'Đăng xuất',
      CONFIG_CHANGE: 'Thay đổi cấu hình',
      SYSTEM_EVENT: 'Sự kiện hệ thống',
    };
    return labels[action] || action;
  };

  const getResultIcon = (result: AuditResult) => {
    switch (result) {
      case 'SUCCESS':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'PENDING':
        return <Clock className="h-5 w-5 text-yellow-600" />;
    }
  };

  const handleExport = () => {
    exportAuditLogs(filteredLogs);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
              <p className="text-gray-600 mt-1">Lịch sử hoạt động và giao dịch</p>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download className="h-5 w-5" />
              <span>Xuất file</span>
            </button>
          </div>

          {/* Statistics */}
          {statistics && (
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Tổng số logs</p>
                <p className="text-2xl font-bold text-blue-600">{statistics.total}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Thành công</p>
                <p className="text-2xl font-bold text-green-600">{statistics.byResult.SUCCESS}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Thất bại</p>
                <p className="text-2xl font-bold text-red-600">{statistics.byResult.FAILED}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">24h qua</p>
                <p className="text-2xl font-bold text-purple-600">{statistics.recentActivity}</p>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as AuditAction | 'all')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tất cả hành động</option>
              <option value="TRANSFER">Chuyển tiền</option>
              <option value="WITHDRAWAL">Rút tiền</option>
              <option value="PKI_REGISTER">Đăng ký PKI</option>
              <option value="KYC_VERIFY">Xác minh KYC</option>
              <option value="AUTHORIZATION_SET">Thiết lập quyền</option>
            </select>

            {/* Result Filter */}
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value as AuditResult | 'all')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tất cả kết quả</option>
              <option value="SUCCESS">Thành công</option>
              <option value="FAILED">Thất bại</option>
              <option value="PENDING">Đang xử lý</option>
            </select>

            {/* Date Filter */}
            <div className="flex space-x-2">
              <input
                type="date"
                value={dateFilter.from}
                onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Từ ngày"
              />
              <input
                type="date"
                value={dateFilter.to}
                onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Đến ngày"
              />
            </div>
          </div>
        </div>

        {/* Logs List */}
        <div className="bg-white rounded-lg shadow-sm">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Không có audit logs nào</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        {getResultIcon(log.result)}
                        <span className={`px-3 py-1 rounded text-sm font-medium ${
                          log.result === 'SUCCESS'
                            ? 'bg-green-100 text-green-700'
                            : log.result === 'FAILED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {getActionLabel(log.action)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          <span className="font-medium">Actor:</span> {formatAddress(log.actor.address)}
                          {log.actor.bankCode && ` (${log.actor.bankCode})`}
                        </p>
                        {log.target?.address && (
                          <p>
                            <span className="font-medium">Target:</span> {formatAddress(log.target.address)}
                            {log.target.bankCode && ` (${log.target.bankCode})`}
                          </p>
                        )}
                        {log.txHash && (
                          <p>
                            <span className="font-medium">Tx Hash:</span>{' '}
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {log.txHash.substring(0, 20)}...
                            </code>
                          </p>
                        )}
                        {log.details.amount && (
                          <p>
                            <span className="font-medium">Số tiền:</span>{' '}
                            {log.details.amount.toLocaleString('vi-VN')} ₫
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Chi tiết Audit Log</h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">ID</p>
                  <p className="font-mono text-sm">{selectedLog.id}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-1">Thời gian</p>
                  <p className="font-medium">
                    {format(new Date(selectedLog.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-1">Hành động</p>
                  <p className="font-medium">{getActionLabel(selectedLog.action)}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-1">Kết quả</p>
                  <div className="flex items-center space-x-2">
                    {getResultIcon(selectedLog.result)}
                    <span className="font-medium">{selectedLog.result}</span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-1">Actor</p>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="font-mono text-sm">{selectedLog.actor.address}</p>
                    {selectedLog.actor.bankCode && (
                      <p className="text-sm text-gray-600">Bank: {selectedLog.actor.bankCode}</p>
                    )}
                    {selectedLog.actor.userId && (
                      <p className="text-sm text-gray-600">User: {selectedLog.actor.userId}</p>
                    )}
                  </div>
                </div>

                {selectedLog.target && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Target</p>
                    <div className="bg-gray-50 p-3 rounded">
                      {selectedLog.target.address && (
                        <p className="font-mono text-sm">{selectedLog.target.address}</p>
                      )}
                      {selectedLog.target.bankCode && (
                        <p className="text-sm text-gray-600">Bank: {selectedLog.target.bankCode}</p>
                      )}
                    </div>
                  </div>
                )}

                {selectedLog.txHash && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Transaction Hash</p>
                    <code className="block bg-gray-100 p-2 rounded text-sm font-mono break-all">
                      {selectedLog.txHash}
                    </code>
                  </div>
                )}

                {selectedLog.blockNumber && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Block Number</p>
                    <p className="font-medium">{selectedLog.blockNumber}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-gray-500 mb-1">Chi tiết</p>
                  <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>

                {selectedLog.metadata && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Metadata</p>
                    <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

