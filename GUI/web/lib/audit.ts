// Audit Logging Service for GUI
// Records all important operations for compliance and security

export type AuditAction =
  | 'PKI_REGISTER'
  | 'PKI_KEY_ROTATION'
  | 'KYC_VERIFY'
  | 'KYC_REVOKE'
  | 'AUTHORIZATION_SET'
  | 'AUTHORIZATION_REVOKE'
  | 'TRANSFER'
  | 'TRANSFER_FAILED'
  | 'WITHDRAWAL'
  | 'WITHDRAWAL_FAILED'
  | 'DEPOSIT'
  | 'BALANCE_CHANGE'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'CONFIG_CHANGE'
  | 'SYSTEM_EVENT';

export type AuditResult = 'SUCCESS' | 'FAILED' | 'PENDING';

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO 8601 format
  actor: {
    address: string;
    bankCode?: string;
    userId?: string;
  };
  action: AuditAction;
  target?: {
    address?: string;
    bankCode?: string;
    userId?: string;
  };
  details: Record<string, any>;
  result: AuditResult;
  txHash?: string;
  blockNumber?: number;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  };
}

const STORAGE_KEY = 'interbank_audit_logs';
const MAX_LOGS = 10000; // Giữ tối đa 10,000 logs

/**
 * Generate unique audit log ID
 */
const generateAuditId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `audit-${timestamp}-${random}`;
};

/**
 * Get current session ID (or generate new one)
 */
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('audit_session_id');
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('audit_session_id', sessionId);
  }
  return sessionId;
};

/**
 * Get user metadata (IP, User Agent, etc.)
 */
const getUserMetadata = (): AuditLogEntry['metadata'] => {
  return {
    sessionId: getSessionId(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    // IP address sẽ được lấy từ server-side nếu có API
  };
};

/**
 * Load all audit logs from storage
 */
export const loadAuditLogs = (): AuditLogEntry[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const logs = JSON.parse(data);
    return logs.sort((a: AuditLogEntry, b: AuditLogEntry) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (error) {
    console.error('Error loading audit logs:', error);
    return [];
  }
};

/**
 * Save audit log entry
 */
export const saveAuditLog = (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void => {
  try {
    const logs = loadAuditLogs();
    
    const auditEntry: AuditLogEntry = {
      id: generateAuditId(),
      timestamp: new Date().toISOString(),
      ...entry,
      metadata: {
        ...getUserMetadata(),
        ...entry.metadata,
      },
    };
    
    logs.unshift(auditEntry);
    
    // Giữ chỉ MAX_LOGS entries mới nhất
    if (logs.length > MAX_LOGS) {
      logs.splice(MAX_LOGS);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    
    // Log to console for debugging (có thể tắt trong production)
    console.log('📋 [AUDIT]', auditEntry.action, auditEntry.result, auditEntry);
    
    // Optionally: Send to server API endpoint
    // sendAuditLogToServer(auditEntry);
  } catch (error) {
    console.error('Error saving audit log:', error);
  }
};

/**
 * Send audit log to server (optional - for centralized logging)
 */
const sendAuditLogToServer = async (entry: AuditLogEntry): Promise<void> => {
  try {
    // Chỉ gửi nếu có API endpoint
    const auditApiUrl = process.env.NEXT_PUBLIC_AUDIT_API_URL;
    if (!auditApiUrl) return;
    
    await fetch(`${auditApiUrl}/audit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(entry),
    });
  } catch (error) {
    // Silent fail - không block user flow nếu audit API down
    console.warn('Failed to send audit log to server:', error);
  }
};

/**
 * Query audit logs with filters
 */
export const queryAuditLogs = (filters: {
  action?: AuditAction;
  actor?: string;
  target?: string;
  result?: AuditResult;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
}): AuditLogEntry[] => {
  let logs = loadAuditLogs();
  
  if (filters.action) {
    logs = logs.filter(log => log.action === filters.action);
  }
  
  if (filters.actor) {
    logs = logs.filter(log => 
      log.actor.address.toLowerCase() === filters.actor!.toLowerCase() ||
      log.actor.userId === filters.actor
    );
  }
  
  if (filters.target) {
    logs = logs.filter(log => 
      log.target?.address?.toLowerCase() === filters.target!.toLowerCase() ||
      log.target?.userId === filters.target
    );
  }
  
  if (filters.result) {
    logs = logs.filter(log => log.result === filters.result);
  }
  
  if (filters.fromDate) {
    logs = logs.filter(log => new Date(log.timestamp) >= filters.fromDate!);
  }
  
  if (filters.toDate) {
    logs = logs.filter(log => new Date(log.timestamp) <= filters.toDate!);
  }
  
  if (filters.limit) {
    logs = logs.slice(0, filters.limit);
  }
  
  return logs;
};

/**
 * Clear old audit logs (older than specified days)
 */
export const clearOldAuditLogs = (daysToKeep: number = 90): void => {
  try {
    const logs = loadAuditLogs();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const filteredLogs = logs.filter(log => 
      new Date(log.timestamp) >= cutoffDate
    );
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredLogs));
    console.log(`🧹 Cleared ${logs.length - filteredLogs.length} old audit logs`);
  } catch (error) {
    console.error('Error clearing old audit logs:', error);
  }
};

/**
 * Export audit logs to JSON file
 */
export const exportAuditLogs = (logs?: AuditLogEntry[]): void => {
  const logsToExport = logs || loadAuditLogs();
  const dataStr = JSON.stringify(logsToExport, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Get audit statistics
 */
export const getAuditStatistics = (): {
  total: number;
  byAction: Record<AuditAction, number>;
  byResult: Record<AuditResult, number>;
  recentActivity: number; // Last 24 hours
} => {
  const logs = loadAuditLogs();
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const byAction: Record<string, number> = {};
  const byResult: Record<AuditResult, number> = {
    SUCCESS: 0,
    FAILED: 0,
    PENDING: 0,
  };
  
  let recentActivity = 0;
  
  logs.forEach(log => {
    // Count by action
    byAction[log.action] = (byAction[log.action] || 0) + 1;
    
    // Count by result
    byResult[log.result]++;
    
    // Count recent activity
    if (new Date(log.timestamp) >= yesterday) {
      recentActivity++;
    }
  });
  
  return {
    total: logs.length,
    byAction: byAction as Record<AuditAction, number>,
    byResult,
    recentActivity,
  };
};

// Convenience functions for common audit actions

/**
 * Log PKI registration
 */
export const auditPKIRegister = (
  actor: { address: string; bankCode?: string; userId?: string },
  target: { address: string; publicKeyHash: string },
  result: AuditResult,
  txHash?: string
): void => {
  saveAuditLog({
    actor,
    action: 'PKI_REGISTER',
    target: { address: target.address },
    details: {
      publicKeyHash: target.publicKeyHash,
      algorithm: 'Dilithium3',
    },
    result,
    txHash,
  });
};

/**
 * Log KYC verification
 */
export const auditKYCVerify = (
  actor: { address: string; bankCode?: string; userId?: string },
  target: { address: string },
  details: { kycHash: string; expiresAt?: number },
  result: AuditResult,
  txHash?: string
): void => {
  saveAuditLog({
    actor,
    action: 'KYC_VERIFY',
    target: { address: target.address },
    details,
    result,
    txHash,
  });
};

/**
 * Log transfer
 */
export const auditTransfer = (
  actor: { address: string; bankCode?: string; userId?: string },
  target: { address: string; bankCode?: string },
  details: {
    amount: number;
    amountWei?: string;
    referenceCode: string;
    description?: string;
  },
  result: AuditResult,
  txHash?: string,
  blockNumber?: number
): void => {
  saveAuditLog({
    actor,
    action: result === 'SUCCESS' ? 'TRANSFER' : 'TRANSFER_FAILED',
    target: { address: target.address, bankCode: target.bankCode },
    details,
    result,
    txHash,
    blockNumber,
  });
};

/**
 * Log authorization change
 */
export const auditAuthorizationSet = (
  actor: { address: string; bankCode?: string; userId?: string },
  target: { address: string },
  details: { dailyLimit: string; canTransfer: boolean; canReceive: boolean },
  result: AuditResult,
  txHash?: string
): void => {
  saveAuditLog({
    actor,
    action: 'AUTHORIZATION_SET',
    target: { address: target.address },
    details,
    result,
    txHash,
  });
};

/**
 * Log withdrawal
 */
export const auditWithdrawal = (
  actor: { address: string; bankCode?: string; userId?: string },
  details: {
    amount: number;
    method: string;
    referenceCode: string;
  },
  result: AuditResult,
  txHash?: string,
  blockNumber?: number
): void => {
  saveAuditLog({
    actor,
    action: result === 'SUCCESS' ? 'WITHDRAWAL' : 'WITHDRAWAL_FAILED',
    details,
    result,
    txHash,
    blockNumber,
  });
};

