// Sync completed transactions from LocalStorage to blockchain
import { Transaction } from '@/types/transaction';
import { BANKS, getAllUsers } from '@/config/banks';
import { sendTransaction, waitForTransaction } from './blockchain';
import { getTransactionsByUser, updateTransactionStatus, getUserTransactionsKey } from './storage';

export interface SyncResult {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ txId: string; error: string }>;
}

/**
 * Get all completed transactions from all users that need to be synced to blockchain
 * (Transactions that are completed but have mock txHash or no txHash)
 */
export const getTransactionsToSync = (): Array<{
  transaction: Transaction;
  bankCode: string;
  userAddress: string;
  privateKey: string;
}> => {
  const transactionsToSync: Array<{
    transaction: Transaction;
    bankCode: string;
    userAddress: string;
    privateKey: string;
  }> = [];

  // Get all users
  const allUsers = getAllUsers();

  // Iterate through all banks
  for (const bank of BANKS) {
    // Iterate through all users in each bank
    for (const user of bank.users) {
      // Get all transactions for this user
      const transactions = getTransactionsByUser(bank.code, user.address);

      // Filter transactions that need syncing
      for (const tx of transactions) {
        // Only sync completed transfer transactions
        if (tx.type === 'transfer' && tx.status === 'completed') {
          // Check if transaction is a mock transaction or doesn't have txHash
          const isMockTx = tx.txHash?.startsWith('0xMOCK_TX_HASH_');
          const hasNoRealTxHash = !tx.txHash || isMockTx;

          if (hasNoRealTxHash) {
            // Find the sender's private key
            const sender = allUsers.find((u) => u.address.toLowerCase() === tx.from.toLowerCase());
            if (sender && sender.privateKey) {
              transactionsToSync.push({
                transaction: tx,
                bankCode: bank.code,
                userAddress: user.address,
                privateKey: sender.privateKey,
              });
            }
          }
        }
      }
    }
  }

  return transactionsToSync;
};

/**
 * Sync a single transaction to blockchain with manual nonce management
 */
export const syncTransactionToBlockchain = async (
  transaction: Transaction,
  privateKey: string,
  bankCode: string,
  userAddress: string,
  nonce: number
): Promise<{ success: boolean; txHash?: string; error?: string }> => {
  try {
    // Skip if not a transfer transaction
    if (transaction.type !== 'transfer') {
      return { success: false, error: 'Only transfer transactions can be synced' };
    }

    // Skip if transaction is not completed
    if (transaction.status !== 'completed') {
      return { success: false, error: 'Only completed transactions can be synced' };
    }

    // Import ethers and config for manual transaction sending
    const { ethers } = await import('ethers');
    const { vndToWei } = await import('@/config/blockchain');
    const { getProvider } = await import('./blockchain');
    
    const provider = getProvider();
    const wallet = new ethers.Wallet(privateKey, provider);
    const amountWei = vndToWei(transaction.amount);

    // Kiểm tra số dư trước khi gửi transaction
    const balance = await provider.getBalance(wallet.address);
    const gasLimit = BigInt(16000000); // Max gas limit (block limit is 16,243,360)
    const gasPrice = BigInt(0); // Free gas for private test network
    const gasCost = gasLimit * gasPrice; // = 0
    const totalCost = amountWei + gasCost;

    if (balance < totalCost) {
      const { weiToVnd } = await import('@/config/blockchain');
      const balanceVND = weiToVnd(balance);
      const amountVND = transaction.amount;
      return {
        success: false,
        error: `Số dư không đủ. Số dư hiện tại trên blockchain: ${balanceVND.toLocaleString('vi-VN')} VND, Cần: ${amountVND.toLocaleString('vi-VN')} VND`,
      };
    }

    // Send transaction with manual nonce
    const txResponse = await wallet.sendTransaction({
      to: transaction.to,
      value: amountWei,
      nonce: nonce, // Sử dụng nonce được quản lý thủ công
      gasLimit: Number(gasLimit),
      gasPrice: 0, // Free gas for private test network
    });

    // Wait for confirmation
    const receipt = await txResponse.wait(1);

    if (receipt && receipt.status === 1) {
      // Update transaction with real blockchain hash
      updateTransactionStatus(
        bankCode,
        userAddress,
        transaction.id,
        'completed',
        receipt.blockNumber,
        txResponse.hash // Update txHash to real blockchain hash
      );

      return { success: true, txHash: txResponse.hash };
    } else {
      return { success: false, error: 'Transaction failed on blockchain' };
    }
  } catch (error: any) {
    console.error(`Error syncing transaction ${transaction.id}:`, error);
    return { success: false, error: error.message || 'Unknown error' };
  }
};

/**
 * Sync all pending transactions to blockchain with proper nonce management
 */
export const syncAllTransactionsToBlockchain = async (
  onProgress?: (current: number, total: number, txId: string) => void
): Promise<SyncResult> => {
  const transactionsToSync = getTransactionsToSync();
  const result: SyncResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  console.log(`Found ${transactionsToSync.length} transactions to sync`);

  if (transactionsToSync.length === 0) {
    return result;
  }

  // Import provider để quản lý nonce
  const { getProvider } = await import('./blockchain');
  const provider = getProvider();

  // Nhóm transactions theo người gửi (để quản lý nonce cho từng ví)
  const txsBySender: Record<string, typeof transactionsToSync> = {};
  
  transactionsToSync.forEach((item) => {
    const senderAddress = item.transaction.from.toLowerCase();
    if (!txsBySender[senderAddress]) {
      txsBySender[senderAddress] = [];
    }
    txsBySender[senderAddress].push(item);
  });

  console.log(`Grouped transactions by ${Object.keys(txsBySender).length} sender(s)`);

  // Xử lý tuần tự từng ví người dùng để quản lý nonce đúng cách
  for (const senderAddress of Object.keys(txsBySender)) {
    const userTxs = txsBySender[senderAddress];
    console.log(`Processing ${userTxs.length} transactions for sender: ${senderAddress}`);

    // Lấy private key từ transaction đầu tiên (tất cả đều cùng sender)
    const firstTx = userTxs[0];
    const privateKey = firstTx.privateKey;

    // LẤY NONCE HIỆN TẠI TỪ BLOCKCHAIN
    let currentNonce: number;
    try {
      currentNonce = await provider.getTransactionCount(senderAddress, 'latest');
      console.log(`Current nonce for ${senderAddress}: ${currentNonce}`);
    } catch (error: any) {
      console.error(`Failed to get nonce for ${senderAddress}:`, error);
      // Skip all transactions for this sender
      userTxs.forEach((item) => {
        result.failed++;
        result.errors.push({
          txId: item.transaction.id,
          error: `Failed to get nonce: ${error.message}`,
        });
      });
      continue;
    }

    // Xử lý từng transaction của người gửi này
    for (let i = 0; i < userTxs.length; i++) {
      const item = userTxs[i];
      const { transaction, bankCode, userAddress } = item;

      const currentIndex = result.success + result.failed + result.skipped + 1;
      if (onProgress) {
        onProgress(currentIndex, transactionsToSync.length, transaction.id);
      }

      // Check if this is a mock transaction - we need to send it again
      const isMockTx = transaction.txHash?.startsWith('0xMOCK_TX_HASH_');
      
      if (isMockTx || !transaction.txHash) {
        try {
          // Sync transaction với nonce được quản lý thủ công
          const syncResult = await syncTransactionToBlockchain(
            transaction,
            privateKey,
            bankCode,
            userAddress,
            currentNonce // Sử dụng nonce hiện tại
          );

          if (syncResult.success) {
            result.success++;
            currentNonce++; // Tăng nonce cho transaction tiếp theo
            console.log(
              `✅ Synced transaction ${transaction.id} with hash ${syncResult.txHash} (nonce: ${currentNonce - 1})`
            );
          } else {
            // Kiểm tra loại lỗi để xử lý phù hợp
            const errorMsg = syncResult.error || '';
            const errorLower = errorMsg.toLowerCase();
            
            // Nếu lỗi do số dư không đủ, skip transaction (không tính là failed nghiêm trọng)
            if (errorLower.includes('số dư không đủ') || 
                errorLower.includes('balance') ||
                errorLower.includes('upfront cost')) {
              result.skipped++;
              console.warn(`⏭️ Skipped transaction ${transaction.id} (insufficient balance): ${errorMsg}`);
            } else {
              result.failed++;
              result.errors.push({
                txId: transaction.id,
                error: errorMsg || 'Unknown error',
              });
              console.error(`❌ Failed to sync transaction ${transaction.id}: ${errorMsg}`);
            }
            
            // Nếu lỗi do nonce, reset lại nonce từ blockchain
            if (errorLower.includes('nonce') || errorLower.includes('replacement')) {
              console.warn('Nonce error detected, resetting nonce...');
              try {
                currentNonce = await provider.getTransactionCount(senderAddress, 'latest');
                console.log(`Reset nonce to: ${currentNonce}`);
              } catch (resetError) {
                console.error('Failed to reset nonce:', resetError);
                // Skip remaining transactions for this sender
                break;
              }
            }
          }
        } catch (error: any) {
          console.error(`Error syncing transaction ${transaction.id}:`, error);
          const errorMsg = error.message || error.toString() || 'Unknown error';
          const errorLower = errorMsg.toLowerCase();
          
          // Kiểm tra loại lỗi để xử lý phù hợp
          if (errorLower.includes('balance') ||
              errorLower.includes('upfront cost') ||
              errorLower.includes('số dư không đủ')) {
            result.skipped++;
            console.warn(`⏭️ Skipped transaction ${transaction.id} (insufficient balance): ${errorMsg}`);
          } else {
            result.failed++;
            result.errors.push({
              txId: transaction.id,
              error: errorMsg,
            });
          }

          // Nếu lỗi do nonce, reset lại nonce từ blockchain
          if (errorLower.includes('nonce') || errorLower.includes('replacement')) {
            console.warn('Nonce error detected, resetting nonce...');
            try {
              currentNonce = await provider.getTransactionCount(senderAddress, 'latest');
              console.log(`Reset nonce to: ${currentNonce}`);
            } catch (resetError) {
              console.error('Failed to reset nonce:', resetError);
              // Skip remaining transactions for this sender
              break;
            }
          }
        }
      } else {
        // Transaction already has a real hash, skip it
        result.skipped++;
        console.log(`⏭️ Skipped transaction ${transaction.id} (already has real txHash)`);
      }

      // Add a small delay between transactions để đảm bảo blockchain có thời gian xử lý
      if (i < userTxs.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Delay giữa các sender khác nhau
    if (Object.keys(txsBySender).indexOf(senderAddress) < Object.keys(txsBySender).length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return result;
};

