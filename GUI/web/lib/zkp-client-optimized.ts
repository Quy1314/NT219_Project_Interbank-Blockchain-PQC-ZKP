/**
 * ZKP Client - OPTIMIZED Version
 * 
 * Optimizations:
 * - Connection pooling
 * - Request batching
 * - Proof caching
 * - Parallel processing
 */

import { BalanceProof, BalanceProofRequest } from './zkp-client';

interface CachedProof {
  proof: BalanceProof;
  timestamp: number;
}

// Proof cache với TTL
const PROOF_CACHE = new Map<string, CachedProof>();
const CACHE_TTL_MS = 60000; // 60 seconds

// Connection pool
let connectionPool: Map<string, AbortController> = new Map();

/**
 * Generate cache key
 */
function getCacheKey(userAddress: string, amount: number, balanceCommitment: string): string {
  return `${userAddress}:${amount}:${balanceCommitment}`;
}

/**
 * Cleanup expired cache entries
 */
function cleanupCache() {
  const now = Date.now();
  for (const [key, entry] of PROOF_CACHE.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      PROOF_CACHE.delete(key);
    }
  }
}

// Cleanup cache every 30 seconds
setInterval(cleanupCache, 30000);

/**
 * OPTIMIZED: Generate balance proof with caching
 */
export async function generateBalanceProofOptimized(
  baseURL: string,
  userAddress: string,
  amount: number,
  balance: number,
  secretNonce: string,
  timeout: number = 5000 // Reduced timeout for faster failure
): Promise<BalanceProof> {
  // Create balance commitment
  const balanceHex = balance.toString(16).padStart(16, '0');
  const balanceCommitment = `${balanceHex}${secretNonce}`;
  
  // Check cache first
  const cacheKey = getCacheKey(userAddress, amount, balanceCommitment);
  const cached = PROOF_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log('[ZKP Client] Using cached proof');
    return cached.proof;
  }

  const request: BalanceProofRequest = {
    user_address: userAddress,
    amount: amount,
    balance_commitment: balanceCommitment,
    secret_nonce: secretNonce,
  };

  // Cancel previous request for same key if exists
  const existingController = connectionPool.get(cacheKey);
  if (existingController) {
    existingController.abort();
  }

  const controller = new AbortController();
  connectionPool.set(cacheKey, controller);

  try {
    const response = await fetch(`${baseURL}/balance/proof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    connectionPool.delete(cacheKey);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.proof) {
      throw new Error(result.message || 'Failed to generate proof');
    }

    // Cache the proof
    PROOF_CACHE.set(cacheKey, {
      proof: result.proof,
      timestamp: Date.now(),
    });

    return result.proof;
  } catch (error: any) {
    connectionPool.delete(cacheKey);
    if (error.name === 'AbortError') {
      throw new Error('Request cancelled');
    }
    throw error;
  }
}

/**
 * OPTIMIZED: Batch generate proofs in parallel
 */
export async function generateBalanceProofsBatch(
  baseURL: string,
  requests: Array<{
    userAddress: string;
    amount: number;
    balance: number;
    secretNonce: string;
  }>,
  concurrency: number = 10 // Process 10 proofs in parallel
): Promise<BalanceProof[]> {
  const results: BalanceProof[] = [];
  
  // Process in batches
  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    const batchPromises = batch.map(req =>
      generateBalanceProofOptimized(
        baseURL,
        req.userAddress,
        req.amount,
        req.balance,
        req.secretNonce
      ).catch(err => {
        console.error(`[ZKP Client] Batch proof generation failed:`, err);
        throw err;
      })
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}

