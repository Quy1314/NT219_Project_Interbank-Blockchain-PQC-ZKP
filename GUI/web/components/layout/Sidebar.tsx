'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Send, CreditCard, History, FileText, RefreshCw } from 'lucide-react';

interface SidebarProps {
  bankCode: string;
}

const menuItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: Send, label: 'Chuyển tiền', href: '/transfer' },
  { icon: CreditCard, label: 'Rút tiền', href: '/withdraw' },
  { icon: History, label: 'Lịch sử', href: '/history' },
  { icon: FileText, label: 'Sao kê', href: '/statement' },
  { icon: RefreshCw, label: 'Sync Blockchain', href: '/sync' },
];

export default function Sidebar({ bankCode }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-gray-800 text-white min-h-screen">
      <nav className="p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const href = `/bank/${bankCode}${item.href}`;
            const isActive = pathname === href;

            return (
              <li key={item.href}>
                <Link
                  href={href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

