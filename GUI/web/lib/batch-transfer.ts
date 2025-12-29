/**
 * Batch Transfer - Optimized batch transaction processing
 * 
 * Features:
 * - Batch multiple transfers into single transaction
 * - Optimized gas usage
 * - Parallel proof generation
 * - Nonce management
 */

import { ethers } from 'ethers';
import { getContractWithSigner, getContractAddress } from './contract';
import { vndToWei } from '@/config/blockchain';
import { getNonce, markTransactionConfirmed, resetNonce } from './nonce-manager';
import { getZKPClient, BalanceProof } from './zkp-client';
import { generateBatchProofs } from './zkp-client-batch';

export interface BatchTransferItem {
  toAddress: string;
  amountVND: number;
  toBankCode: string;
  description: string;
  useZKP?: boolean;
}

export interface BatchTransferResult {
  success: boolean;
  transactionIds?: number[];
  txHash?: string;
  error?: string;
}

/**
 * Batch transfer với ZKP proofs (nếu enabled)
 */
export async function batchTransferWithZKP(
  fromPrivateKey: string,
  transfers: BatchTransferItem[],
  useZKP: boolean = true
): Promise<BatchTransferResult> {
  if (transfers.length === 0) {
    return { success: false, error: 'Empty transfers array' };
  }
  
  if (transfers.length > 50) {
    return { success: false, error: 'Batch size too large (max 50)' };
  }
  
  try {
    const { getProvider } = await import('./blockchain');
    const provider = getProvider();
    const wallet = new ethers.Wallet(fromPrivateKey, provider);
    const senderAddress = wallet.address;
    
    // Get contract
    const contract = getContractWithSigner(fromPrivateKey);
    const contractAddress = getContractAddress();
    
    // Prepare batch data
    const recipients: string[] = [];
    const amounts: bigint[] = [];
    const toBankCodes: string[] = [];
    const descriptions: string[] = [];
    
    let totalAmountVND = 0;
    for (const transfer of transfers) {
      recipients.push(transfer.toAddress);
      amounts.push(vndToWei(transfer.amountVND));
      toBankCodes.push(transfer.toBankCode);
      descriptions.push(transfer.description);
      totalAmountVND += transfer.amountVND;
    }
    
    // Check balance
    const balance = await contract.getBalance(senderAddress);
    const totalAmountWei = amounts.reduce((sum, amt) => sum + amt, BigInt(0));
    if (balance < totalAmountWei) {
      return {
        success: false,
        error: `Insufficient balance: ${balance.toString()} < ${totalAmountWei.toString()}`,
      };
    }
    
    // Generate ZKP proofs in parallel (if enabled)
    let proofAmounts: bigint[] = [];
    let commitmentHashes: string[] = [];
    let proofBytesArray: string[] = [];
    
    if (useZKP) {
      try {
        const zkpClient = getZKPClient();
        const isHealthy = await zkpClient.healthCheck();
        
        if (isHealthy) {
          // Get balance in VND for proof generation
          const { weiToVnd } = await import('@/config/blockchain');
          const balanceVND = weiToVnd(balance);
          
          // Prepare batch proof requests
          const batchProofRequests = transfers.map(transfer => {
            const secretNonce = ethers.randomBytes(32).toString('hex');
            const balanceHex = balanceVND.toString(16).padStart(16, '0');
            const balanceCommitment = `${balanceHex}${secretNonce}`;
            
            return {
              user_address: senderAddress,
              amount: transfer.amountVND,
              balance_commitment: balanceCommitment,
              secret_nonce: secretNonce,
            };
          });
          
          // Call batch API
          const zkpBaseURL = process.env.NEXT_PUBLIC_ZKP_PROVER_URL || 'http://localhost:8081';
          const batchResult = await generateBatchProofs(zkpBaseURL, batchProofRequests);
          
          if (!batchResult.success || batchResult.proofs.length === 0) {
            throw new Error('Failed to generate batch proofs');
          }
          
          // Convert proofs to contract format
          proofAmounts = amounts;
          commitmentHashes = batchResult.proofs
            .filter(p => p !== null)
            .map(p => '0x' + (p as BalanceProof).commitment_hash);
          proofBytesArray = batchResult.proofs
            .filter(p => p !== null)
            .map(p => '0x' + (p as BalanceProof).proof_bytes.map(b => b.toString(16).padStart(2, '0')).join(''));
        } else {
          console.warn('⚠️ ZKP Prover not available, falling back to regular batch transfer');
          useZKP = false;
        }
      } catch (error: any) {
        console.error('❌ Error generating ZKP proofs:', error);
        console.warn('⚠️ Falling back to regular batch transfer');
        useZKP = false;
      }
    }
    
    // Get nonce
    const nonce = await getNonce(senderAddress, true);
    
    // Call batch transfer function
    let txResponse: ethers.TransactionResponse;
    
    if (useZKP && proofAmounts.length > 0) {
      // Batch transfer with ZKP - use contract method directly
      txResponse = await contract['batchTransferWithZKP'](
        recipients,
        amounts,
        toBankCodes,
        descriptions,
        proofAmounts,
        commitmentHashes,
        proofBytesArray,
        {
          nonce,
          gasLimit: 16000000,
          gasPrice: 0,
        }
      );
    } else {
      // Regular batch transfer - use contract method directly
      txResponse = await contract['batchTransfer'](
        recipients,
        amounts,
        toBankCodes,
        descriptions,
        {
          nonce,
          gasLimit: 16000000,
          gasPrice: 0,
        }
      );
    }
    
    // Wait for confirmation
    const receipt = await txResponse.wait(1);
    
    if (receipt && receipt.status === 1) {
      // Mark transaction as confirmed
      markTransactionConfirmed(senderAddress, nonce);
      
      // Parse transaction IDs from events
      const transferEvents = receipt.logs
        .filter(log => {
          try {
            const parsed = contract.interface.parseLog(log);
            return parsed?.name === 'Transfer';
          } catch {
            return false;
          }
        })
        .map(log => {
          const parsed = contract.interface.parseLog(log);
          return parsed?.args[0]; // transactionId
        });
      
      return {
        success: true,
        transactionIds: transferEvents.map(id => Number(id)),
        txHash: txResponse.hash,
      };
    } else {
      resetNonce(senderAddress);
      return { success: false, error: 'Transaction failed on blockchain' };
    }
  } catch (error: any) {
    const { getProvider } = await import('./blockchain');
    const provider = getProvider();
    const wallet = new ethers.Wallet(fromPrivateKey, provider);
    resetNonce(wallet.address);
    
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

