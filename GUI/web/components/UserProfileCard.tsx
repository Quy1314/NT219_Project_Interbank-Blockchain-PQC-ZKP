'use client';

import React, { useEffect, useState } from 'react';
import { getContract } from '@/lib/blockchain';
import { PKI_REGISTRY_ADDRESS } from '@/config/contracts';
import PKIRegistryABI from '@/config/abis/PKIRegistry.json';
import { Shield, CheckCircle, XCircle, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { getBankByCode, getAllUsers } from '@/config/banks';

interface UserIdentity {
  userAddress: string;
  keyHash: string;
  isActive: boolean;
  registeredAt: bigint;
  lastUpdated: bigint;
}

interface KYCInfo {
  isVerified: boolean;
  verifiedAt: bigint;
  expiresAt: bigint;
  kycHash: string;
  verifier: string;
}

interface Authorization {
  canTransfer: boolean;
  canReceive: boolean;
  dailyLimit: bigint;
  usedToday: bigint;
  lastResetDate: bigint;
}

interface UserProfileCardProps {
  userAddress: string;
}

export default function UserProfileCard({ userAddress }: UserProfileCardProps) {
  const [loading, setLoading] = useState(true);
  const [userIdentity, setUserIdentity] = useState<UserIdentity | null>(null);
  const [kycInfo, setKYCInfo] = useState<KYCInfo | null>(null);
  const [authorization, setAuthorization] = useState<Authorization | null>(null);
  const [error, setError] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [showPQCKey, setShowPQCKey] = useState(false);

  useEffect(() => {
    if (userAddress) {
      loadUserProfile();
    }
  }, [userAddress]);

  async function loadUserProfile() {
    try {
      setLoading(true);
      setError('');

      // Get PKI Registry contract
      const pkiContract = await getContract(PKI_REGISTRY_ADDRESS, PKIRegistryABI.abi);
      if (!pkiContract) {
        setError('PKI Registry not available');
        setLoading(false);
        return;
      }

      // Check if user is registered
      const userInfo = await pkiContract.getUserInfo(userAddress);
      
      // Parse user identity
      const identity: UserIdentity = {
        userAddress: userInfo[0].userAddress,
        keyHash: userInfo[0].keyHash,
        isActive: userInfo[0].isActive,
        registeredAt: userInfo[0].registeredAt,
        lastUpdated: userInfo[0].lastUpdated,
      };

      // Parse KYC info
      const kyc: KYCInfo = {
        isVerified: userInfo[1].isVerified,
        verifiedAt: userInfo[1].verifiedAt,
        expiresAt: userInfo[1].expiresAt,
        kycHash: userInfo[1].kycHash,
        verifier: userInfo[1].verifier,
      };

      // Parse authorization
      const auth: Authorization = {
        canTransfer: userInfo[2].canTransfer,
        canReceive: userInfo[2].canReceive,
        dailyLimit: userInfo[2].dailyLimit,
        usedToday: userInfo[2].usedToday,
        lastResetDate: userInfo[2].lastResetDate,
      };

      setUserIdentity(identity);
      setKYCInfo(kyc);
      setAuthorization(auth);

    } catch (err: any) {
      console.error('Error loading user profile:', err);
      if (err.message?.includes('User not registered')) {
        setError('Not registered in PKI');
      } else {
        setError('PKI data unavailable');
      }
    } finally {
      setLoading(false);
    }
  }

  function formatDate(timestamp: bigint): string {
    if (!timestamp || timestamp === BigInt(0)) return 'N/A';
    return new Date(Number(timestamp) * 1000).toLocaleDateString('vi-VN');
  }

  const getUserPassword = (): string | null => {
    const allUsers = getAllUsers();
    const user = allUsers.find(u => u.address.toLowerCase() === userAddress.toLowerCase());
    return user?.password || null;
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    const userPassword = getUserPassword();
    if (!userPassword) {
      setPasswordError('Không tìm thấy thông tin user');
      return;
    }

    if (password === userPassword) {
      setIsAuthenticated(true);
      setShowPasswordInput(false);
      setPassword('');
      // Auto logout after 5 minutes
      setTimeout(() => {
        setIsAuthenticated(false);
        setShowPQCKey(false);
      }, 5 * 60 * 1000);
    } else {
      setPasswordError('Mật khẩu không đúng. Vui lòng thử lại.');
      setPassword('');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
    setShowPQCKey(false);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100 h-full">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Shield className="h-5 w-5 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">PKI Info</h3>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !userIdentity) {
    return (
      <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100 h-full">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <Shield className="h-5 w-5 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">PKI Info</h3>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-start space-x-2 text-gray-600">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{error || 'Not registered'}</p>
              <p className="text-xs text-gray-500 mt-1">
                This user has not been registered in PKI Registry yet.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const kycStatus = kycInfo?.isVerified && kycInfo.expiresAt > BigInt(Math.floor(Date.now() / 1000));
  const dailyLimitUsed = Number(authorization?.usedToday || BigInt(0)) / 1e18;
  const dailyLimitTotal = Number(authorization?.dailyLimit || BigInt(0)) / 1e18;
  const dailyLimitPercent = dailyLimitTotal > 0 ? (dailyLimitUsed / dailyLimitTotal) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100 h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Shield className="h-5 w-5 text-indigo-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">PKI Info</h3>
        </div>
        <div className="flex items-center space-x-2">
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="text-xs text-red-600 hover:text-red-700 flex items-center space-x-1 px-2 py-1 rounded hover:bg-red-50"
            >
              <Lock className="h-3 w-3" />
              <span>Khóa</span>
            </button>
          )}
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            userIdentity.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {userIdentity.isActive ? '✓ Active' : '✗ Inactive'}
          </span>
        </div>
      </div>

      {/* Password Protection for PKI Details */}
      {!isAuthenticated && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Lock className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-900 mb-2">
                Thông tin PKI được bảo vệ bằng mật khẩu
              </p>
              {!showPasswordInput ? (
                <button
                  onClick={() => setShowPasswordInput(true)}
                  className="text-sm text-yellow-700 hover:text-yellow-800 font-medium flex items-center space-x-1"
                >
                  <Shield className="h-4 w-4" />
                  <span>Nhập mật khẩu để xem chi tiết PKI</span>
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

      {/* KYC Status - Chỉ hiển thị chi tiết sau khi authenticate */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">KYC Status</h4>
          <span className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-semibold ${
            kycStatus ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {kycStatus ? (
              <>
                <CheckCircle className="h-3 w-3" />
                <span>Verified</span>
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3" />
                <span>Not Verified</span>
              </>
            )}
          </span>
        </div>
        
        {isAuthenticated && kycInfo?.isVerified ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-50 p-2 rounded-lg">
              <p className="text-gray-500 mb-1">Verified</p>
              <p className="font-semibold text-gray-800">{formatDate(kycInfo.verifiedAt)}</p>
            </div>
            <div className="bg-gray-50 p-2 rounded-lg">
              <p className="text-gray-500 mb-1">Expires</p>
              <p className="font-semibold text-gray-800">{formatDate(kycInfo.expiresAt)}</p>
            </div>
          </div>
        ) : !isAuthenticated && kycInfo?.isVerified ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-500 text-center">
              🔒 Nhập mật khẩu để xem chi tiết KYC
            </p>
          </div>
        ) : null}
      </div>

      {/* Authorization - Chỉ hiển thị chi tiết sau khi authenticate */}
      <div className="mb-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Permissions</h4>
        {isAuthenticated ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Transfer</p>
              <span className={`inline-flex items-center space-x-1 text-xs font-semibold ${
                authorization?.canTransfer ? 'text-green-600' : 'text-red-600'
              }`}>
                {authorization?.canTransfer ? (
                  <>
                    <CheckCircle className="h-3 w-3" />
                    <span>Allowed</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" />
                    <span>Denied</span>
                  </>
                )}
              </span>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Receive</p>
              <span className={`inline-flex items-center space-x-1 text-xs font-semibold ${
                authorization?.canReceive ? 'text-green-600' : 'text-red-600'
              }`}>
                {authorization?.canReceive ? (
                  <>
                    <CheckCircle className="h-3 w-3" />
                    <span>Allowed</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" />
                    <span>Denied</span>
                  </>
                )}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-500 text-center">
              🔒 Nhập mật khẩu để xem quyền truy cập
            </p>
          </div>
        )}
      </div>

      {/* Daily Limit - Chỉ hiển thị chi tiết sau khi authenticate */}
      {dailyLimitTotal > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-700">Daily Limit</h4>
            {isAuthenticated ? (
              <span className="text-xs text-gray-600 font-medium">{dailyLimitPercent.toFixed(0)}%</span>
            ) : (
              <span className="text-xs text-gray-400">🔒</span>
            )}
          </div>
          
          {isAuthenticated ? (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-lg font-bold text-indigo-600">{dailyLimitUsed.toFixed(1)}</span>
                <span className="text-xs text-gray-600">/ {dailyLimitTotal.toFixed(0)} ETH</span>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-white rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    dailyLimitPercent > 90 ? 'bg-red-500' : 
                    dailyLimitPercent > 70 ? 'bg-yellow-500' : 
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(dailyLimitPercent, 100)}%` }}
                ></div>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500 text-center py-2">
              Nhập mật khẩu để xem chi tiết
            </p>
          )}
        </div>
      )}

      {/* PQC Public Key - CHỈ hiển thị sau khi authenticate */}
      {isAuthenticated && userIdentity && (
        <div className="mt-5 pt-5 border-t-2 border-purple-200 bg-purple-50/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-purple-700 flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>PQC Public Key (Dilithium3)</span>
            </h4>
            <button
              onClick={() => setShowPQCKey(!showPQCKey)}
              className="text-xs text-purple-600 hover:text-purple-700 flex items-center space-x-1"
            >
              {showPQCKey ? (
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
          {showPQCKey ? (
            <div className="bg-white p-3 rounded border border-purple-200">
              <p className="text-xs font-mono text-purple-900 break-all">
                {userIdentity.keyHash}
              </p>
              <p className="text-xs text-purple-600 mt-2">
                Key Hash: {userIdentity.keyHash.substring(0, 20)}...
              </p>
            </div>
          ) : (
            <p className="text-xs text-purple-600 text-center">
              Key Hash: {userIdentity.keyHash.substring(0, 20)}... (Click "Hiện" để xem đầy đủ)
            </p>
          )}
        </div>
      )}
    </div>
  );
}

