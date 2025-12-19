/**
 * React Hook for Post-Quantum Cryptography operations
 * 
 * Usage:
 * ```typescript
 * const { signTransaction, verifySignature, isKSMReady } = usePQC();
 * 
 * // Sign a transaction
 * const signature = await signTransaction(from, to, amount, description);
 * 
 * // Verify signature
 * const isValid = await verifySignature(entityId, message, signature);
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { getKSMClient, PQCSignature, SignedTransaction } from './ksm-client';
import { getPQCEnabled, setPQCEnabled, PQC_ENABLED_DEFAULT } from '@/config/pqc';

export interface PQCConfig {
  enabled: boolean;
  autoGenerateKeys: boolean;
  ksmUrl?: string;
}

export interface UsePQCReturn {
  isKSMReady: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Operations
  generateKey: (entityId: string) => Promise<void>;
  signTransaction: (from: string, to: string, amount: number, description: string) => Promise<PQCSignature>;
  verifySignature: (entityId: string, message: string, signature: string) => Promise<boolean>;
  createSignedTransaction: (from: string, to: string, amount: number, description: string) => Promise<SignedTransaction>;
  
  // Utilities
  checkHealth: () => Promise<boolean>;
  clearError: () => void;
}

export function usePQC(config?: PQCConfig): UsePQCReturn {
  const [isKSMReady, setIsKSMReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ksmClient = getKSMClient();

  // Check KSM health on mount
  useEffect(() => {
    const checkKSMHealth = async () => {
      try {
        const healthy = await ksmClient.healthCheck();
        setIsKSMReady(healthy);
        
        if (!healthy) {
          console.warn('[usePQC] KSM service is not available');
        }
      } catch (err) {
        console.error('[usePQC] Failed to check KSM health:', err);
        setIsKSMReady(false);
      }
    };

    checkKSMHealth();
    
    // Check health every 30 seconds
    const interval = setInterval(checkKSMHealth, 30000);
    
    return () => clearInterval(interval);
  }, [config?.ksmUrl]);

  /**
   * Check KSM health manually
   */
  const checkHealth = useCallback(async (): Promise<boolean> => {
    try {
      const healthy = await ksmClient.healthCheck();
      setIsKSMReady(healthy);
      return healthy;
    } catch (err) {
      console.error('[usePQC] Health check failed:', err);
      setIsKSMReady(false);
      return false;
    }
  }, []);

  /**
   * Generate PQC key pair for an entity
   */
  const generateKey = useCallback(async (entityId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await ksmClient.generateKey(entityId);
      console.log(`[usePQC] Key generated for ${entityId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate key';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Sign a transaction
   */
  const signTransaction = useCallback(async (
    from: string,
    to: string,
    amount: number,
    description: string
  ): Promise<PQCSignature> => {
    setIsLoading(true);
    setError(null);

    try {
      // Create transaction message
      const txMessage = JSON.stringify({ from, to, amount, description, timestamp: Date.now() });
      
      // Sign with KSM
      const signature = await ksmClient.sign(from, txMessage);
      
      console.log(`[usePQC] Transaction signed for ${from} → ${to}`);
      return signature;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign transaction';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Verify a signature
   */
  const verifySignature = useCallback(async (
    entityId: string,
    message: string,
    signature: string
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const isValid = await ksmClient.verify(entityId, message, signature);
      console.log(`[usePQC] Signature verification: ${isValid}`);
      return isValid;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to verify signature';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create a signed transaction (all-in-one)
   */
  const createSignedTransaction = useCallback(async (
    from: string,
    to: string,
    amount: number,
    description: string
  ): Promise<SignedTransaction> => {
    setIsLoading(true);
    setError(null);

    try {
      const signedTx = await ksmClient.createSignedTransaction(from, to, amount, description);
      console.log(`[usePQC] Signed transaction created: ${from} → ${to}`);
      return signedTx;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create signed transaction';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isKSMReady,
    isLoading,
    error,
    generateKey,
    signTransaction,
    verifySignature,
    createSignedTransaction,
    checkHealth,
    clearError
  };
}

/**
 * Utility: Check if PQC is enabled in configuration
 * Default: ENABLED (true) - PQC is enabled by default
 * 
 * @deprecated Use getPQCEnabled() from @/config/pqc instead
 */
export function isPQCEnabled(): boolean {
  return getPQCEnabled();
}

/**
 * Utility: Enable/disable PQC
 * 
 * @deprecated Use setPQCEnabled() from @/config/pqc instead
 */
export function togglePQC(enabled: boolean): void {
  setPQCEnabled(enabled);
}

