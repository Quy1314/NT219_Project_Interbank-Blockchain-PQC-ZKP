'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import UserSelector from '@/components/UserSelector';
import { getBankByCode, BankConfig, BankUser } from '@/config/banks';
import { getSelectedUser, setSelectedUser, getSelectedBank, setSelectedBank } from '@/lib/storage';
import { startPeriodicAutoSync, stopPeriodicAutoSync } from '@/lib/autoSync';

export default function BankLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const bankCode = params.bankCode as string;
  
  const [bank, setBank] = useState<BankConfig | null>(null);
  const [selectedUser, setSelectedUserState] = useState<BankUser | null>(null);

  useEffect(() => {
    // Start periodic auto-sync when component mounts
    startPeriodicAutoSync();
    
    // Cleanup: stop periodic sync when component unmounts
    return () => {
      stopPeriodicAutoSync();
    };
  }, []);

  useEffect(() => {
    // Reset state khi bankCode thay đổi
    setBank(null);
    setSelectedUserState(null);

    const bankConfig = getBankByCode(bankCode);
    if (!bankConfig) {
      router.push('/');
      return;
    }
    
    setBank(bankConfig);
    setSelectedBank(bankCode);

    // Check if we're switching banks - reset user selection
    const currentBank = getSelectedBank();
    if (currentBank && currentBank !== bankCode) {
      // Switching banks - clear old user selection
      setSelectedUser(null);
    }

    // Load selected user from storage (only if user exists in this bank)
    const savedUserId = getSelectedUser();
    if (savedUserId) {
      const user = bankConfig.users.find((u) => u.id === savedUserId);
      if (user) {
        setSelectedUserState(user);
        return;
      } else {
        // User from old bank doesn't exist in new bank - clear it
        setSelectedUser(null);
      }
    }

    // Default to first user of the new bank
    if (bankConfig.users.length > 0) {
      const defaultUser = bankConfig.users[0];
      setSelectedUserState(defaultUser);
      setSelectedUser(defaultUser.id);
    }
  }, [bankCode, router]);

  const handleSelectUser = (user: BankUser) => {
    setSelectedUserState(user);
    setSelectedUser(user.id);
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event('userChanged'));
  };

  if (!bank) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Đang tải...</div>
      </div>
    );
  }

  // Redirect to dashboard if on base bank path (without trailing route)
  if (pathname === `/bank/${bankCode}` || pathname === `/bank/${bankCode}/`) {
    router.replace(`/bank/${bankCode}/dashboard`);
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header bank={bank} />
      <div className="flex">
        <Sidebar bankCode={bankCode} />
        <main className="flex-1 p-8">
          <div className="mb-6 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              {bank.name} - Hệ thống Liên ngân hàng
            </h1>
            <UserSelector
              bank={bank}
              selectedUser={selectedUser}
              onSelectUser={handleSelectUser}
            />
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

