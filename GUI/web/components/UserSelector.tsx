'use client';

import { useState } from 'react';
import { BankConfig, BankUser } from '@/config/banks';
import { ChevronDown, User } from 'lucide-react';

interface UserSelectorProps {
  bank: BankConfig;
  selectedUser: BankUser | null;
  onSelectUser: (user: BankUser) => void;
}

export default function UserSelector({ bank, selectedUser, onSelectUser }: UserSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <User className="h-5 w-5 text-gray-600" />
        <span className="font-medium text-gray-700">
          {selectedUser ? (selectedUser.fullName || selectedUser.name) : 'Chọn người dùng'}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-600" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="p-2">
              {bank.users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    onSelectUser(user);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    selectedUser?.id === user.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="font-medium">{user.fullName || user.name}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {user.address.slice(0, 10)}...{user.address.slice(-8)}
                  </div>
                  {user.phone && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {user.phone}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

