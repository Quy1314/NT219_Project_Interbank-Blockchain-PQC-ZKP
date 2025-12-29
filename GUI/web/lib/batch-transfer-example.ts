/**
 * Batch Transfer Example - Cách sử dụng để đạt 50+ TPS
 * 
 * Ví dụ này minh họa cách batch nhiều transfers thành 1 transaction
 */

import { batchTransferWithZKP, BatchTransferItem } from './batch-transfer';

/**
 * Ví dụ 1: Batch 50 transfers thành 1 transaction
 */
export async function exampleBatch50Transfers() {
  const fromPrivateKey = '0x...'; // Your private key
  
  // Tạo 50 transfers
  const transfers: BatchTransferItem[] = [];
  for (let i = 0; i < 50; i++) {
    transfers.push({
      toAddress: `0x${i.toString(16).padStart(40, '0')}`,
      amountVND: 1000 + i * 100,
      toBankCode: 'VCB',
      description: `Batch transfer ${i + 1}`,
    });
  }
  
  // Gửi tất cả trong 1 transaction
  const result = await batchTransferWithZKP(
    fromPrivateKey,
    transfers,
    true // useZKP
  );
  
  if (result.success) {
    console.log('✅ Batch transfer successful!');
    console.log('Transaction hash:', result.txHash);
    console.log('Transaction IDs:', result.transactionIds);
    console.log(`Sent ${transfers.length} transfers in 1 transaction`);
  }
}

/**
 * Ví dụ 2: Batch nhiều batches song song để đạt 50+ TPS
 */
export async function exampleParallelBatches() {
  const fromPrivateKey = '0x...';
  
  // Tạo 5 batches, mỗi batch 10 transfers
  const batches: BatchTransferItem[][] = [];
  for (let batchIdx = 0; batchIdx < 5; batchIdx++) {
    const batch: BatchTransferItem[] = [];
    for (let i = 0; i < 10; i++) {
      batch.push({
        toAddress: `0x${(batchIdx * 10 + i).toString(16).padStart(40, '0')}`,
        amountVND: 1000,
        toBankCode: 'VCB',
        description: `Batch ${batchIdx + 1}, Transfer ${i + 1}`,
      });
    }
    batches.push(batch);
  }
  
  // Gửi tất cả batches song song
  const results = await Promise.all(
    batches.map(batch => batchTransferWithZKP(fromPrivateKey, batch, true))
  );
  
  const successCount = results.filter(r => r.success).length;
  console.log(`✅ Sent ${successCount} batches successfully`);
  console.log(`Total transfers: ${successCount * 10}`);
}

/**
 * Ví dụ 3: Batch từ queue của pending transfers
 */
export async function exampleBatchFromQueue() {
  const fromPrivateKey = '0x...';
  
  // Giả sử có queue của pending transfers
  const pendingTransfers: BatchTransferItem[] = [
    // ... transfers từ queue
  ];
  
  // Batch thành các nhóm 50 transfers
  const batchSize = 50;
  const batches: BatchTransferItem[][] = [];
  
  for (let i = 0; i < pendingTransfers.length; i += batchSize) {
    batches.push(pendingTransfers.slice(i, i + batchSize));
  }
  
  // Gửi từng batch (có thể song song hoặc tuần tự)
  for (const batch of batches) {
    const result = await batchTransferWithZKP(fromPrivateKey, batch, true);
    if (result.success) {
      console.log(`✅ Batch sent: ${batch.length} transfers`);
    }
  }
}

/**
 * Tính toán TPS dựa trên batch size và latency
 */
export function calculateTPS(batchSize: number, latencySeconds: number): number {
  return batchSize / latencySeconds;
}

// Ví dụ:
// - Batch 50 transfers, latency 4 giây
// - TPS = 50 / 4 = 12.5 TPS
//
// Để đạt 50 TPS:
// - Batch 200 transfers, latency 4 giây
// - TPS = 200 / 4 = 50 TPS
// HOẶC
// - Batch 50 transfers, latency 1 giây
// - TPS = 50 / 1 = 50 TPS

