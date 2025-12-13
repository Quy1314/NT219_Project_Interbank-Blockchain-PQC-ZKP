/**
 * Post-Quantum Cryptography Configuration
 * 
 * This file contains configuration for PQC features in the GUI.
 * PQC is ENABLED by default to provide quantum-resistant security.
 */

// =====================================
// PQC Feature Flag
// =====================================

/**
 * Check if PQC is enabled
 * Default: true (ENABLED)
 * 
 * To disable PQC, set NEXT_PUBLIC_PQC_ENABLED=false in .env.local
 * or call togglePQC(false) in the browser console
 */
export const PQC_ENABLED_DEFAULT = true;

/**
 * Get PQC enabled status
 */
export function getPQCEnabled(): boolean {
  // Check environment variable (can be 'true' or 'false')
  const envValue = process.env.NEXT_PUBLIC_PQC_ENABLED;
  
  if (envValue !== undefined) {
    return envValue === 'true';
  }
  
  // Check localStorage (client-side only)
  if (typeof window !== 'undefined') {
    const localValue = localStorage.getItem('pqc_enabled');
    if (localValue !== null) {
      return localValue === 'true';
    }
  }
  
  // Default: ENABLED
  return PQC_ENABLED_DEFAULT;
}

/**
 * Set PQC enabled status
 */
export function setPQCEnabled(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('pqc_enabled', enabled.toString());
    console.log(`[PQC Config] PQC ${enabled ? 'ENABLED' : 'DISABLED'}`);
    
    // Trigger storage event for other tabs
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'pqc_enabled',
      newValue: enabled.toString(),
      storageArea: localStorage
    }));
  }
}

// =====================================
// KSM Service Configuration
// =====================================

/**
 * KSM Service URL
 * Default: http://localhost:8080
 */
export const KSM_SERVICE_URL = process.env.NEXT_PUBLIC_KSM_URL || 'http://localhost:8080';

/**
 * KSM API timeout (milliseconds)
 */
export const KSM_TIMEOUT = 10000; // 10 seconds

/**
 * KSM health check interval (milliseconds)
 */
export const KSM_HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// =====================================
// PQC Algorithms
// =====================================

/**
 * Default signature algorithm
 * Options: Dilithium2, Dilithium3, Dilithium5
 */
export const DEFAULT_SIGNATURE_ALGORITHM = 'Dilithium3';

/**
 * Default encryption algorithm
 * Options: Kyber512, Kyber768, Kyber1024
 */
export const DEFAULT_ENCRYPTION_ALGORITHM = 'Kyber768';

/**
 * Supported signature algorithms
 */
export const SUPPORTED_SIGNATURE_ALGORITHMS = [
  'Dilithium2',
  'Dilithium3',
  'Dilithium5'
] as const;

/**
 * Supported encryption algorithms
 */
export const SUPPORTED_ENCRYPTION_ALGORITHMS = [
  'Kyber512',
  'Kyber768',
  'Kyber1024'
] as const;

// =====================================
// Auto Key Generation
// =====================================

/**
 * Auto-generate PQC keys for entities on first use
 * Default: true
 */
export const AUTO_GENERATE_KEYS = true;

/**
 * Entities to pre-generate keys for
 */
export const PRELOAD_ENTITIES = [
  'vietcombank',
  'vietinbank',
  'bidv',
  'agribank',
  'techcombank',
  'mbbank'
] as const;

// =====================================
// UI Configuration
// =====================================

/**
 * Show PQC status in UI
 */
export const SHOW_PQC_STATUS = true;

/**
 * Show PQC signature details in transaction
 */
export const SHOW_SIGNATURE_DETAILS = false; // Set to true for debugging

/**
 * PQC status messages
 */
export const PQC_STATUS_MESSAGES = {
  enabled: '🔒 PQC Enabled (Quantum-Resistant)',
  disabled: '⚠️ PQC Disabled (Standard Crypto)',
  ksmReady: '✅ KSM Service Ready',
  ksmNotReady: '❌ KSM Service Not Available',
  signing: '🔐 Signing with PQC...',
  verifying: '🔍 Verifying PQC Signature...',
} as const;

// =====================================
// Performance Settings
// =====================================

/**
 * Cache PQC public keys (reduces KSM calls)
 */
export const CACHE_PUBLIC_KEYS = true;

/**
 * Public key cache TTL (milliseconds)
 */
export const PUBLIC_KEY_CACHE_TTL = 3600000; // 1 hour

/**
 * Batch sign multiple transactions
 */
export const ENABLE_BATCH_SIGNING = false; // Future feature

// =====================================
// Development/Debug
// =====================================

/**
 * Enable PQC debug logging
 */
export const PQC_DEBUG = process.env.NODE_ENV === 'development';

/**
 * Log PQC operations to console
 */
export function logPQC(message: string, data?: any): void {
  if (PQC_DEBUG) {
    console.log(`[PQC] ${message}`, data || '');
  }
}

/**
 * Fallback to standard crypto if PQC fails
 * Default: false (fail if PQC is enabled but unavailable)
 */
export const FALLBACK_TO_STANDARD_CRYPTO = false;

