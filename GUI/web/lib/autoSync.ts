// Auto-sync service for automatically syncing transactions to blockchain
import { syncTransactionToBlockchain, getTransactionsToSync } from './syncTransactions';
import { getProvider } from './blockchain';
import { Transaction } from '@/types/transaction';
import { getAllUsers } from '@/config/banks';

// Auto-sync configuration
const AUTO_SYNC_ENABLED = true; // Enable/disable auto-sync
const AUTO_SYNC_DELAY = 2000; // Delay before auto-sync (ms) - wait for transaction to be saved
const PERIODIC_SYNC_INTERVAL = 30000; // Periodic sync every 30 seconds

// Track if auto-sync is running to prevent concurrent syncs
let isAutoSyncing = false;
let periodicSyncTimer: NodeJS.Timeout | null = null;

/**
 * Auto-sync a single transaction to blockchain
 */
export const autoSyncTransaction = async (
  transaction: Transaction,
  bankCode: string,
  userAddress: string,
  privateKey: string
): Promise<{ success: boolean; txHash?: string; error?: string }> => {
  if (!AUTO_SYNC_ENABLED) {
    return { success: false, error: 'Auto-sync is disabled' };
  }

  // Only sync completed transfer transactions
  if (transaction.type !== 'transfer' || transaction.status !== 'completed') {
    return { success: false, error: 'Only completed transfer transactions can be synced' };
  }

  // Check if transaction already has a real txHash
  const isMockTx = transaction.txHash?.startsWith('0xMOCK_TX_HASH_');
  const hasNoRealTxHash = !transaction.txHash || isMockTx;

  if (!hasNoRealTxHash) {
    return { success: false, error: 'Transaction already has real txHash' };
  }

  try {
    const provider = getProvider();
    const senderAddress = transaction.from.toLowerCase();
    
    // Get current nonce
    const currentNonce = await provider.getTransactionCount(senderAddress, 'latest');
    
    // Sync transaction
    const result = await syncTransactionToBlockchain(
      transaction,
      privateKey,
      bankCode,
      userAddress,
      currentNonce
    );

    if (result.success) {
      console.log(`✅ Auto-synced transaction ${transaction.id} with hash ${result.txHash}`);
    } else {
      console.warn(`⚠️ Auto-sync failed for transaction ${transaction.id}: ${result.error}`);
    }

    return result;
  } catch (error: any) {
    console.error(`❌ Error auto-syncing transaction ${transaction.id}:`, error);
    return { success: false, error: error.message || 'Unknown error' };
  }
};

/**
 * Auto-sync all pending transactions
 */
export const autoSyncAllPending = async (): Promise<void> => {
  if (!AUTO_SYNC_ENABLED || isAutoSyncing) {
    return;
  }

  isAutoSyncing = true;

  try {
    const transactionsToSync = getTransactionsToSync();
    
    if (transactionsToSync.length === 0) {
      return;
    }

    console.log(`🔄 Auto-syncing ${transactionsToSync.length} pending transaction(s)...`);

    const provider = getProvider();
    const txsBySender: Record<string, typeof transactionsToSync> = {};
    
    // Group transactions by sender
    transactionsToSync.forEach((item) => {
      const senderAddress = item.transaction.from.toLowerCase();
      if (!txsBySender[senderAddress]) {
        txsBySender[senderAddress] = [];
      }
      txsBySender[senderAddress].push(item);
    });

    // Process each sender sequentially
    for (const senderAddress of Object.keys(txsBySender)) {
      const userTxs = txsBySender[senderAddress];
      const firstTx = userTxs[0];
      const privateKey = firstTx.privateKey;

      try {
        let currentNonce = await provider.getTransactionCount(senderAddress, 'latest');
        
        // Sync each transaction for this sender
        for (const item of userTxs) {
          const { transaction, bankCode, userAddress } = item;
          
          const result = await syncTransactionToBlockchain(
            transaction,
            privateKey,
            bankCode,
            userAddress,
            currentNonce
          );

          if (result.success) {
            console.log(`✅ Auto-synced transaction ${transaction.id}`);
            currentNonce++;
          } else {
            // If nonce error, reset nonce
            if (result.error?.toLowerCase().includes('nonce')) {
              currentNonce = await provider.getTransactionCount(senderAddress, 'latest');
            }
          }

          // Small delay between transactions
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error: any) {
        console.error(`Error auto-syncing transactions for ${senderAddress}:`, error);
      }

      // Delay between senders
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log('✅ Auto-sync completed');
  } catch (error: any) {
    console.error('❌ Error in auto-sync:', error);
  } finally {
    isAutoSyncing = false;
  }
};

/**
 * Start periodic auto-sync
 */
export const startPeriodicAutoSync = (): void => {
  if (!AUTO_SYNC_ENABLED) {
    return;
  }

  // Clear existing timer if any
  if (periodicSyncTimer) {
    clearInterval(periodicSyncTimer);
  }

  // Start periodic sync
  periodicSyncTimer = setInterval(() => {
    autoSyncAllPending().catch((error) => {
      console.error('Error in periodic auto-sync:', error);
    });
  }, PERIODIC_SYNC_INTERVAL);

  console.log(`🔄 Started periodic auto-sync (every ${PERIODIC_SYNC_INTERVAL / 1000}s)`);
};

/**
 * Stop periodic auto-sync
 */
export const stopPeriodicAutoSync = (): void => {
  if (periodicSyncTimer) {
    clearInterval(periodicSyncTimer);
    periodicSyncTimer = null;
    console.log('⏹️ Stopped periodic auto-sync');
  }
};

/**
 * Auto-sync a transaction after it's saved (with delay)
 */
export const scheduleAutoSync = (
  transaction: Transaction,
  bankCode: string,
  userAddress: string
): void => {
  if (!AUTO_SYNC_ENABLED) {
    return;
  }

  // Find sender's private key
  const allUsers = getAllUsers();
  const sender = allUsers.find((u) => u.address.toLowerCase() === transaction.from.toLowerCase());

  if (!sender || !sender.privateKey) {
    console.warn(`⚠️ Cannot auto-sync transaction ${transaction.id}: sender not found`);
    return;
  }

  // Schedule auto-sync after delay
  setTimeout(() => {
    autoSyncTransaction(transaction, bankCode, userAddress, sender.privateKey).catch((error) => {
      console.error(`Error auto-syncing transaction ${transaction.id}:`, error);
    });
  }, AUTO_SYNC_DELAY);
};

