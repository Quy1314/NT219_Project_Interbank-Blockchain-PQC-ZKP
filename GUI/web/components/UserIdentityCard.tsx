'use client';

import { useState } from 'react';
import { User, Calendar, IdCard, Phone, Mail, MapPin, UserCircle, Eye, EyeOff, Copy, Lock, Shield, Key } from 'lucide-react';
import { BankUser } from '@/config/banks';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface UserIdentityCardProps {
  user: BankUser;
}

export default function UserIdentityCard({ user }: UserIdentityCardProps) {
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Chưa cập nhật';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: vi });
    } catch {
      return dateString;
    }
  };

  const calculateAge = (dateOfBirth?: string): number | null => {
    if (!dateOfBirth) return null;
    try {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    } catch {
      return null;
    }
  };

  const getGenderLabel = (gender?: string): string => {
    switch (gender) {
      case 'male':
        return 'Nam';
      case 'female':
        return 'Nữ';
      case 'other':
        return 'Khác';
      default:
        return 'Chưa cập nhật';
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (password === user.password) {
      setIsAuthenticated(true);
      setShowPasswordInput(false);
      setPassword('');
      // Auto logout after 5 minutes
      setTimeout(() => {
        setIsAuthenticated(false);
        setShowFullAddress(false);
      }, 5 * 60 * 1000);
    } else {
      setPasswordError('Mật khẩu không đúng. Vui lòng thử lại.');
      setPassword('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    setShowFullAddress(false);
  };

  const age = calculateAge(user.dateOfBirth);

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <UserCircle className="h-7 w-7 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {user.fullName || user.name}
            </h3>
            <p className="text-sm text-gray-500">Thông tin định danh</p>
          </div>
        </div>
        {isAuthenticated && (
          <button
            onClick={handleLogout}
            className="text-xs text-red-600 hover:text-red-700 flex items-center space-x-1 px-2 py-1 rounded hover:bg-red-50"
          >
            <Lock className="h-3 w-3" />
            <span>Khóa</span>
          </button>
        )}
      </div>

      {/* Password Protection */}
      {!isAuthenticated && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Lock className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-900 mb-2">
                Thông tin được bảo vệ bằng mật khẩu
              </p>
              {!showPasswordInput ? (
                <button
                  onClick={() => setShowPasswordInput(true)}
                  className="text-sm text-yellow-700 hover:text-yellow-800 font-medium flex items-center space-x-1"
                >
                  <Shield className="h-4 w-4" />
                  <span>Nhập mật khẩu để xem thông tin</span>
                </button>
              ) : (
                <form onSubmit={handlePasswordSubmit} className="space-y-3">
                  <div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError('');
                      }}
                      placeholder="Nhập mật khẩu"
                      className="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-sm"
                      autoFocus
                    />
                    {passwordError && (
                      <p className="text-xs text-red-600 mt-1">{passwordError}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium"
                    >
                      Xác nhận
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordInput(false);
                        setPassword('');
                        setPasswordError('');
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Tên đầy đủ - Luôn hiển thị */}
        {user.fullName && (
          <div className="flex items-start space-x-3">
            <User className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-1">Tên đầy đủ</p>
              <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
            </div>
          </div>
        )}

        {/* Thông tin nhạy cảm - Chỉ hiển thị sau khi authenticate */}
        {isAuthenticated ? (
          <>
            {/* Ngày sinh */}
            {user.dateOfBirth && (
              <div className="flex items-start space-x-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Ngày sinh</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-900">{formatDate(user.dateOfBirth)}</p>
                    {age !== null && (
                      <span className="text-xs text-gray-500">({age} tuổi)</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Giới tính */}
            {user.gender && (
              <div className="flex items-start space-x-3">
                <UserCircle className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Giới tính</p>
                  <p className="text-sm font-medium text-gray-900">{getGenderLabel(user.gender)}</p>
                </div>
              </div>
            )}

            {/* CMND/CCCD */}
            {user.idNumber && (
              <div className="flex items-start space-x-3">
                <IdCard className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">CMND/CCCD</p>
                  <p className="text-sm font-mono font-medium text-gray-900">{user.idNumber}</p>
                </div>
              </div>
            )}

            {/* Số điện thoại */}
            {user.phone && (
              <div className="flex items-start space-x-3">
                <Phone className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Số điện thoại</p>
                  <p className="text-sm font-medium text-gray-900">{user.phone}</p>
                </div>
              </div>
            )}

            {/* Email */}
            {user.email && (
              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Email</p>
                  <p className="text-sm font-medium text-gray-900 break-all">{user.email}</p>
                </div>
              </div>
            )}

            {/* Địa chỉ */}
            {user.addressLine && (
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Địa chỉ thường trú</p>
                  <p className="text-sm font-medium text-gray-900">{user.addressLine}</p>
                </div>
              </div>
            )}

            {/* Private Key - CHỈ hiển thị sau khi authenticate */}
            <div className="flex items-start space-x-3 pt-3 border-t-2 border-red-200 bg-red-50/50 rounded-lg p-3">
              <Key className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-red-700">Private Key (Bảo mật cao)</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(user.privateKey);
                      setCopied('privateKey');
                      setTimeout(() => setCopied(''), 2000);
                    }}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center space-x-1"
                    title="Copy private key"
                  >
                    <Copy className="h-3 w-3" />
                    <span>{copied === 'privateKey' ? 'Đã copy!' : 'Copy'}</span>
                  </button>
                </div>
                <p className="text-xs font-mono text-red-900 break-all bg-white p-2 rounded border border-red-200">
                  {user.privateKey}
                </p>
                <p className="text-xs text-red-600 mt-1 italic">
                  ⚠️ Cảnh báo: Không chia sẻ private key với bất kỳ ai!
                </p>
              </div>
            </div>

            {/* Blockchain Address - Chỉ hiển thị đầy đủ sau khi authenticate */}
            <div className="flex items-start space-x-3 pt-3 border-t border-gray-200">
              <div className="w-5 h-5 flex-shrink-0"></div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500">Địa chỉ Blockchain</p>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(user.address);
                        setCopied('address');
                        setTimeout(() => setCopied(''), 2000);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                      title="Copy địa chỉ"
                    >
                      <Copy className="h-3 w-3" />
                      <span>{copied === 'address' ? 'Đã copy!' : 'Copy'}</span>
                    </button>
                    <button
                      onClick={() => setShowFullAddress(!showFullAddress)}
                      className="text-xs text-gray-600 hover:text-gray-700 flex items-center space-x-1"
                      title={showFullAddress ? 'Ẩn địa chỉ' : 'Hiện địa chỉ đầy đủ'}
                    >
                      {showFullAddress ? (
                        <>
                          <EyeOff className="h-3 w-3" />
                          <span>Ẩn</span>
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3" />
                          <span>Hiện</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                {showFullAddress ? (
                  <p className="text-xs font-mono text-gray-600 break-all bg-gray-50 p-2 rounded border border-gray-200">
                    {user.address}
                  </p>
                ) : (
                  <p className="text-xs font-mono text-gray-600">
                    {user.address.slice(0, 10)}...{user.address.slice(-8)}
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Thông tin bị ẩn khi chưa authenticate */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-2 text-gray-500">
                <Lock className="h-4 w-4" />
                <p className="text-xs">Thông tin nhạy cảm đã được ẩn</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Ngày sinh:</span>
                  <span className="text-xs text-gray-400">••••••••</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">CMND/CCCD:</span>
                  <span className="text-xs text-gray-400">••••••••</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Số điện thoại:</span>
                  <span className="text-xs text-gray-400">••••••••</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Email:</span>
                  <span className="text-xs text-gray-400">••••••••</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Địa chỉ:</span>
                  <span className="text-xs text-gray-400">••••••••</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                  <span className="text-xs font-semibold text-red-600">Private Key:</span>
                  <span className="text-xs text-gray-400">🔒 Đã khóa</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

