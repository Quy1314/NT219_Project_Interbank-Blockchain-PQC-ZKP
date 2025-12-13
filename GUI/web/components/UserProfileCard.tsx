'use client';

import { useEffect, useState } from 'react';
import { getContract } from '@/lib/blockchain';
import { PKI_REGISTRY_ADDRESS } from '@/config/contracts';
import PKIRegistryABI from '@/config/abis/PKIRegistry.json';
import { Shield, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

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
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          userIdentity.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {userIdentity.isActive ? '✓ Active' : '✗ Inactive'}
        </span>
      </div>

      {/* KYC Status */}
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
        
        {kycInfo?.isVerified && (
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
        )}
      </div>

      {/* Authorization */}
      <div className="mb-5">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Permissions</h4>
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
      </div>

      {/* Daily Limit */}
      {dailyLimitTotal > 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-gray-700">Daily Limit</h4>
            <span className="text-xs text-gray-600 font-medium">{dailyLimitPercent.toFixed(0)}%</span>
          </div>
          
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
        </div>
      )}

      {/* PQC Badge */}
      <div className="mt-5 flex items-center justify-center space-x-2 bg-purple-50 p-2.5 rounded-lg border border-purple-100">
        <Shield className="h-4 w-4 text-purple-600" />
        <span className="text-xs font-semibold text-purple-700">Quantum-Resistant</span>
      </div>
    </div>
  );
}

