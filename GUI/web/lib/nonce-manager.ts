/**
 * Nonce Manager - Centralized nonce management với pre-fetching
 * 
 * Optimizations:
 * - Pre-fetch nonces để giảm latency
 * - Cache nonces với TTL
 * - Automatic nonce synchronization
 * - Support for high TPS (50+)
 */

import { getProvider } from './blockchain';
import { ethers } from 'ethers';

interface NonceCacheEntry {
  nonce: number;
  timestamp: number;
  pendingCount: number; // Số transactions đang pending với nonce này
}

// Nonce cache per address
const nonceCache = new Map<string, NonceCacheEntry>();

// Cache TTL: 5 giây (nonce có thể thay đổi nhanh)
const CACHE_TTL_MS = 5000;

// Pre-fetch interval: 1 giây
const PREFETCH_INTERVAL_MS = 1000;

// Track pending transactions per address
const pendingTransactions = new Map<string, Set<number>>();

/**
 * Cleanup expired cache entries
 */
function cleanupCache() {
  const now = Date.now();
  for (const [address, entry] of nonceCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      nonceCache.delete(address);
    }
  }
}

// Cleanup cache every 5 seconds
setInterval(cleanupCache, 5000);

/**
 * Pre-fetch nonces for addresses
 */
async function prefetchNonces(addresses: string[]) {
  const provider = getProvider();
  const now = Date.now();
  
  for (const address of addresses) {
    try {
      const nonce = await provider.getTransactionCount(address, 'latest');
      const pendingCount = pendingTransactions.get(address.toLowerCase())?.size || 0;
      
      nonceCache.set(address.toLowerCase(), {
        nonce: nonce + pendingCount, // Account for pending transactions
        timestamp: now,
        pendingCount,
      });
    } catch (error) {
      console.error(`[NonceManager] Failed to prefetch nonce for ${address}:`, error);
    }
  }
}

/**
 * Get nonce for address (with caching and pre-fetching)
 */
export async function getNonce(address: string, increment: boolean = false): Promise<number> {
  const addressLower = address.toLowerCase();
  const now = Date.now();
  
  // Check cache first
  const cached = nonceCache.get(addressLower);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    const nonce = cached.nonce;
    
    if (increment) {
      // Increment nonce and update cache
      cached.nonce++;
      cached.pendingCount++;
      
      // Track pending transaction
      if (!pendingTransactions.has(addressLower)) {
        pendingTransactions.set(addressLower, new Set());
      }
      pendingTransactions.get(addressLower)!.add(nonce);
    }
    
    return nonce;
  }
  
  // Fetch from blockchain
  const provider = getProvider();
  try {
    const blockchainNonce = await provider.getTransactionCount(address, 'latest');
    const pendingCount = pendingTransactions.get(addressLower)?.size || 0;
    const nonce = blockchainNonce + pendingCount;
    
    nonceCache.set(addressLower, {
      nonce: increment ? nonce + 1 : nonce,
      timestamp: now,
      pendingCount: increment ? pendingCount + 1 : pendingCount,
    });
    
    if (increment) {
      if (!pendingTransactions.has(addressLower)) {
        pendingTransactions.set(addressLower, new Set());
      }
      pendingTransactions.get(addressLower)!.add(nonce);
    }
    
    return nonce;
  } catch (error: any) {
    console.error(`[NonceManager] Failed to get nonce for ${address}:`, error);
    throw new Error(`Failed to get nonce: ${error.message}`);
  }
}

/**
 * Mark transaction as confirmed (remove from pending)
 */
export function markTransactionConfirmed(address: string, nonce: number) {
  const addressLower = address.toLowerCase();
  const pending = pendingTransactions.get(addressLower);
  if (pending) {
    pending.delete(nonce);
    if (pending.size === 0) {
      pendingTransactions.delete(addressLower);
    }
  }
  
  // Update cache
  const cached = nonceCache.get(addressLower);
  if (cached) {
    cached.pendingCount = Math.max(0, cached.pendingCount - 1);
  }
}

/**
 * Reset nonce for address (when transaction fails)
 */
export function resetNonce(address: string) {
  const addressLower = address.toLowerCase();
  nonceCache.delete(addressLower);
  pendingTransactions.delete(addressLower);
}

/**
 * Pre-fetch nonces for multiple addresses
 */
export async function prefetchNoncesForAddresses(addresses: string[]) {
  await prefetchNonces(addresses);
}

/**
 * Start periodic pre-fetching for active addresses
 */
let prefetchInterval: NodeJS.Timeout | null = null;
const activeAddresses = new Set<string>();

export function startNoncePrefetching(addresses: string[]) {
  // Add addresses to active set
  addresses.forEach(addr => activeAddresses.add(addr.toLowerCase()));
  
  // Initial prefetch
  prefetchNonces(Array.from(activeAddresses));
  
  // Start periodic prefetching
  if (!prefetchInterval) {
    prefetchInterval = setInterval(() => {
      if (activeAddresses.size > 0) {
        prefetchNonces(Array.from(activeAddresses));
      }
    }, PREFETCH_INTERVAL_MS);
  }
}

export function stopNoncePrefetching() {
  if (prefetchInterval) {
    clearInterval(prefetchInterval);
    prefetchInterval = null;
  }
  activeAddresses.clear();
}

export function addAddressToPrefetch(address: string) {
  activeAddresses.add(address.toLowerCase());
}

export function removeAddressFromPrefetch(address: string) {
  activeAddresses.delete(address.toLowerCase());
}

/**
 * Get cache statistics
 */
export function getNonceCacheStats() {
  return {
    cachedAddresses: nonceCache.size,
    activeAddresses: activeAddresses.size,
    pendingTransactions: Array.from(pendingTransactions.entries()).reduce(
      (sum, [_, pending]) => sum + pending.size,
      0
    ),
  };
}

