'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Transaction {
  id: string;
  type: string;
  from: string;
  to: string;
  amount: number;
  timestamp: Date;
  status: string;
}

interface TransactionChartProps {
  transactions: Transaction[];
  userAddress: string;
}

export default function TransactionChart({ transactions, userAddress }: TransactionChartProps) {
  // Group transactions by day
  const chartData = processTransactions(transactions, userAddress);

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-6">Transaction Analytics</h3>
      
      {chartData.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No transaction data available</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => `${value.toLocaleString()}`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(value: any) => [`${value.toLocaleString()} VND`, '']}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
            <Bar 
              dataKey="sent" 
              fill="#ef4444" 
              name="Chuyển đi (Sent)"
              radius={[8, 8, 0, 0]}
            />
            <Bar 
              dataKey="received" 
              fill="#10b981" 
              name="Nhận về (Received)"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Summary Stats */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {calculateTotal(chartData, 'sent').toLocaleString()} VND
            </div>
            <div className="text-sm text-gray-600 mt-1">Total Sent</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {calculateTotal(chartData, 'received').toLocaleString()} VND
            </div>
            <div className="text-sm text-gray-600 mt-1">Total Received</div>
          </div>
        </div>
      )}
    </div>
  );
}

function processTransactions(transactions: Transaction[], userAddress: string) {
  // Get last 7 days
  const days = 7;
  const today = new Date();
  const dateMap = new Map<string, { sent: number; received: number }>();

  // Initialize last 7 days
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = formatDate(date);
    dateMap.set(dateKey, { sent: 0, received: 0 });
  }

  // Process transactions
  transactions.forEach((tx) => {
    if (tx.type !== 'transfer' || tx.status !== 'completed') return;

    const txDate = new Date(tx.timestamp);
    const dateKey = formatDate(txDate);

    // Only include transactions from last 7 days
    if (!dateMap.has(dateKey)) return;

    const data = dateMap.get(dateKey)!;
    const isSender = tx.from.toLowerCase() === userAddress.toLowerCase();

    if (isSender) {
      data.sent += tx.amount;
    } else {
      data.received += tx.amount;
    }
  });

  // Convert to array
  return Array.from(dateMap.entries()).map(([date, data]) => ({
    date,
    sent: Math.round(data.sent),
    received: Math.round(data.received),
  }));
}

function formatDate(date: Date): string {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  return `${day}/${month}`;
}

function calculateTotal(data: any[], key: 'sent' | 'received'): number {
  return data.reduce((sum, item) => sum + (item[key] || 0), 0);
}

