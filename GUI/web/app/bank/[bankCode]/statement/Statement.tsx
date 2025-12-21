'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Download, FileText, Calendar } from 'lucide-react';
import { getBankByCode, BankUser } from '@/config/banks';
import { formatVND } from '@/config/blockchain';
import { getBalanceVND } from '@/lib/blockchain';
import { getBalanceForUser } from '@/lib/balances';
import { getTransactionsByUser, getStoredBalance } from '@/lib/storage';
import { Transaction } from '@/types/transaction';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subMonths, subQuarters } from 'date-fns';
import { vi } from 'date-fns/locale';

export default function Statement() {
  const params = useParams();
  const bankCode = params.bankCode as string;

  const [user, setUser] = useState<BankUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedQuarter, setSelectedQuarter] = useState(
    `Q${Math.floor((new Date().getMonth() + 3) / 3)}-${new Date().getFullYear()}`
  );
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv'>('pdf');
  const [balance, setBalance] = useState<number | null>(null); // Start with null, load real balance

  useEffect(() => {
    const bank = getBankByCode(bankCode);
    if (!bank) return;

    const loadUser = () => {
      const savedUserId = localStorage.getItem('interbank_selected_user');
      const selectedUser = bank.users.find((u) => u.id === savedUserId) || bank.users[0];
      setUser(selectedUser);
    };

    loadUser();

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

  // Reload transactions and balance when user changes
  useEffect(() => {
    if (user) {
      const userTransactions = getTransactionsByUser(bankCode, user.address);
      setTransactions(userTransactions);
      loadBalance(user.address);
    }
  }, [user?.address, bankCode]);

  const loadBalance = async (address: string) => {
    // 1. Ưu tiên: Kiểm tra LocalStorage (số dư mới nhất sau giao dịch)
    try {
      const storedBalance = getStoredBalance(address);
      if (storedBalance !== null) {
        setBalance(storedBalance);
        return; // Dùng luôn số này để khớp với giao dịch
      }
    } catch (error) {
      console.error('Error loading balance from storage:', error);
    }

    // 2. Thử lấy từ Blockchain
    try {
      const blockchainBalance = await getBalanceVND(address);
      if (blockchainBalance !== null && blockchainBalance >= 0) {
        setBalance(blockchainBalance);
        return;
      }
    } catch (error) {
      console.error('Error loading balance from blockchain:', error);
    }
    
    // 3. Fallback to file (getBalanceForUser cũng sẽ check LocalStorage)
    try {
      const fileBalance = await getBalanceForUser(address);
      if (fileBalance !== null && fileBalance >= 0) {
        setBalance(fileBalance);
        return;
      }
    } catch (error) {
      console.error('Error loading balance from file:', error);
    }
    
    // Last resort: set to 0 if nothing works
    setBalance(0);
  };

  const getFilteredTransactions = (): Transaction[] => {
    let startDate: Date;
    let endDate: Date;

    if (period === 'month') {
      const [year, month] = selectedMonth.split('-').map(Number);
      startDate = startOfMonth(new Date(year, month - 1));
      endDate = endOfMonth(new Date(year, month - 1));
    } else if (period === 'quarter') {
      const [quarter, year] = selectedQuarter.split('-');
      const quarterNum = parseInt(quarter.substring(1));
      const yearNum = parseInt(year);
      startDate = startOfQuarter(new Date(yearNum, (quarterNum - 1) * 3));
      endDate = endOfQuarter(new Date(yearNum, (quarterNum - 1) * 3));
    } else {
      startDate = new Date(customDateFrom);
      endDate = new Date(customDateTo);
      endDate.setHours(23, 59, 59, 999);
    }

    return transactions.filter(
      (tx) => tx.timestamp >= startDate && tx.timestamp <= endDate
    );
  };

  const generatePDF = () => {
    // This is a simplified PDF generation. In production, use a proper PDF library
    const filtered = getFilteredTransactions();
    const content = generateStatementContent(filtered);
    
    // Create a simple text-based PDF (in production, use jsPDF or similar)
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sao-ke-${period}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateCSV = () => {
    const filtered = getFilteredTransactions();
    const headers = ['Mã tham chiếu', 'Loại', 'Trạng thái', 'Số tiền (VND)', 'Thời gian', 'Mô tả'];
    const rows = filtered.map((tx) => [
      tx.referenceCode,
      tx.type === 'transfer' ? 'Chuyển tiền' : 'Rút tiền',
      tx.status === 'completed' ? 'Hoàn tất' : tx.status,
      tx.amount.toString(),
      format(tx.timestamp, 'dd/MM/yyyy HH:mm'),
      tx.description || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sao-ke-${period}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateStatementContent = (filtered: Transaction[]): string => {
    const totalIn = filtered
      .filter((tx) => tx.type === 'withdrawal')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalOut = filtered
      .filter((tx) => tx.type === 'transfer')
      .reduce((sum, tx) => sum + tx.amount, 0);

    let content = `SAO KÊ TÀI KHOẢN\n`;
    content += `Ngân hàng: ${user?.name || ''}\n`;
    content += `Địa chỉ: ${user?.address || ''}\n`;
    content += `Kỳ: ${period === 'month' ? format(new Date(selectedMonth + '-01'), 'MM/yyyy') : period === 'quarter' ? selectedQuarter : `${customDateFrom} - ${customDateTo}`}\n`;
    content += `Ngày xuất: ${format(new Date(), 'dd/MM/yyyy HH:mm')}\n\n`;
    content += `Tổng số giao dịch: ${filtered.length}\n`;
    content += `Tổng tiền rút: ${formatVND(totalIn)}\n`;
    content += `Tổng tiền chuyển: ${formatVND(totalOut)}\n`;
    content += `Số dư cuối kỳ: ${balance !== null ? formatVND(balance) : 'Chưa có'}\n\n`;
    content += `CHI TIẾT GIAO DỊCH\n`;
    content += `-`.repeat(80) + `\n`;

    filtered.forEach((tx) => {
      content += `Mã: ${tx.referenceCode}\n`;
      content += `Loại: ${tx.type === 'transfer' ? 'Chuyển tiền' : 'Rút tiền'}\n`;
      content += `Số tiền: ${formatVND(tx.amount)}\n`;
      content += `Thời gian: ${format(tx.timestamp, 'dd/MM/yyyy HH:mm')}\n`;
      if (tx.description) content += `Mô tả: ${tx.description}\n`;
      content += `Trạng thái: ${tx.status === 'completed' ? 'Hoàn tất' : tx.status}\n`;
      content += `-`.repeat(80) + `\n`;
    });

    return content;
  };

  const handleExport = () => {
    if (exportFormat === 'pdf') {
      generatePDF();
    } else {
      generateCSV();
    }
  };

  const filteredTransactions = getFilteredTransactions();

  if (!user) {
    return <div className="text-gray-600">Đang tải...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Sao kê</h2>

      {/* Period Selection */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Chọn kỳ sao kê</h3>
        
        <div className="space-y-4">
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => setPeriod('month')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                period === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Theo tháng
            </button>
            <button
              type="button"
              onClick={() => setPeriod('quarter')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                period === 'quarter'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Theo quý
            </button>
            <button
              type="button"
              onClick={() => setPeriod('custom')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                period === 'custom'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tùy chọn
            </button>
          </div>

          {period === 'month' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chọn tháng
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {period === 'quarter' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chọn quý
              </label>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={`Q1-${new Date().getFullYear()}`}>
                  Q1 - {new Date().getFullYear()}
                </option>
                <option value={`Q2-${new Date().getFullYear()}`}>
                  Q2 - {new Date().getFullYear()}
                </option>
                <option value={`Q3-${new Date().getFullYear()}`}>
                  Q3 - {new Date().getFullYear()}
                </option>
                <option value={`Q4-${new Date().getFullYear()}`}>
                  Q4 - {new Date().getFullYear()}
                </option>
              </select>
            </div>
          )}

          {period === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tổng hợp</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Số giao dịch</p>
            <p className="text-2xl font-bold text-gray-900">{filteredTransactions.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Tổng tiền rút</p>
            <p className="text-2xl font-bold text-green-600">
              {formatVND(
                filteredTransactions
                  .filter((tx) => tx.type === 'withdrawal')
                  .reduce((sum, tx) => sum + tx.amount, 0)
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Tổng tiền chuyển</p>
            <p className="text-2xl font-bold text-red-600">
              {formatVND(
                filteredTransactions
                  .filter((tx) => tx.type === 'transfer')
                  .reduce((sum, tx) => sum + tx.amount, 0)
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Số dư hiện tại</p>
            <p className="text-2xl font-bold text-blue-600">
              {balance !== null ? formatVND(balance) : 'Đang tải...'}
            </p>
          </div>
        </div>
      </div>

      {/* Export Options */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Xuất sao kê</h3>
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setExportFormat('pdf')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                exportFormat === 'pdf'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FileText className="h-5 w-5 inline mr-2" />
              PDF
            </button>
            <button
              type="button"
              onClick={() => setExportFormat('csv')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                exportFormat === 'csv'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FileText className="h-5 w-5 inline mr-2" />
              CSV
            </button>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="flex-1 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
          >
            <Download className="h-5 w-5" />
            <span>Tải xuống</span>
          </button>
        </div>
      </div>
    </div>
  );
}

