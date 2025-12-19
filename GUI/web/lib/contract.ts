// Smart Contract interaction utilities
import { ethers } from 'ethers';
import { getProvider } from './blockchain';
import { vndToWei, weiToVnd } from '@/config/blockchain';
import { INTERBANK_TRANSFER_ABI, INTERBANK_TRANSFER_ADDRESS } from '@/config/contracts';
import { getZKPClient, BalanceProof } from './zkp-client';
import { getKSMClient } from './ksm-client';

// Contract instance cache
let contractInstance: ethers.Contract | null = null;

/**
 * Get the contract instance
 */
export const getContract = (): ethers.Contract => {
  if (!contractInstance) {
    if (!INTERBANK_TRANSFER_ADDRESS) {
      throw new Error('Contract address not set. Please deploy the contract first and set NEXT_PUBLIC_CONTRACT_ADDRESS environment variable.');
    }
    const provider = getProvider();
    contractInstance = new ethers.Contract(INTERBANK_TRANSFER_ADDRESS, INTERBANK_TRANSFER_ABI, provider);
  }
  return contractInstance;
};

/**
 * Check if contract bytecode exists on-chain
 */
const isContractAvailable = async (): Promise<boolean> => {
  if (!INTERBANK_TRANSFER_ADDRESS) {
    return false;
  }

  try {
    const provider = getProvider();
    const code = await provider.getCode(INTERBANK_TRANSFER_ADDRESS);
    const deployed = !!code && code !== '0x';

    if (!deployed) {
      console.warn(
        `⚠️ Contract at ${INTERBANK_TRANSFER_ADDRESS} has no bytecode. ` +
        'Make sure the contract is deployed or set NEXT_PUBLIC_CONTRACT_ADDRESS.'
      );
    }

    return deployed;
  } catch (error) {
    console.error('Error checking contract deployment:', error);
    return false;
  }
};

/**
 * Get contract instance with signer (for write operations)
 */
export const getContractWithSigner = (privateKey: string): ethers.Contract => {
  if (!INTERBANK_TRANSFER_ADDRESS) {
    throw new Error('Contract address not set. Please deploy the contract first and set NEXT_PUBLIC_CONTRACT_ADDRESS environment variable.');
  }
  const provider = getProvider();
  const wallet = new ethers.Wallet(privateKey, provider);
  return new ethers.Contract(INTERBANK_TRANSFER_ADDRESS, INTERBANK_TRANSFER_ABI, wallet);
};

/**
 * Get balance from smart contract
 */
export const getContractBalance = async (userAddress: string): Promise<number | null> => {
  try {
    if (!(await isContractAvailable())) {
      console.warn(
        `Skipping getContractBalance because contract at ${INTERBANK_TRANSFER_ADDRESS} is not deployed.`
      );
      return null;
    }

    console.log('🔍 getContractBalance - Checking balance for:', userAddress);
    console.log('📝 Contract address:', INTERBANK_TRANSFER_ADDRESS);
    
    const contract = getContract();
    const balanceWei = await contract.getBalance(userAddress);
    const balanceVND = weiToVnd(balanceWei);
    const balanceETH = ethers.formatEther(balanceWei);
    
    console.log(`💰 Contract balance for ${userAddress}:`);
    console.log(`   - Wei: ${balanceWei.toString()}`);
    console.log(`   - ETH: ${balanceETH}`);
    console.log(`   - VND: ${balanceVND.toLocaleString('vi-VN')} ₫`);
    
    return balanceVND;
  } catch (error: any) {
    console.error('❌ Error getting balance from contract:', error);
    console.error('   Address:', userAddress);
    console.error('   Contract:', INTERBANK_TRANSFER_ADDRESS);
    console.error('   Error message:', error.message);
    return null;
  }
};

/**
 * Transfer funds using smart contract
 */
export const transferViaContract = async (
  fromPrivateKey: string,
  toAddress: string,
  amountVND: number,
  toBankCode: string,
  description: string
): Promise<{ txHash: string; txId: bigint }> => {
  if (!(await isContractAvailable())) {
    throw new Error(
      'Smart contract chưa được triển khai hoặc NEXT_PUBLIC_CONTRACT_ADDRESS không chính xác. ' +
      'Vui lòng deploy contract và cập nhật địa chỉ trước khi thực hiện giao dịch.'
    );
  }

  const amountWei = vndToWei(amountVND);
  
  // Get wallet and address first
  const wallet = new ethers.Wallet(fromPrivateKey);
  const senderAddress = wallet.address;
  
  // Use read-only contract for balance check
  const readContract = getContract();
  
  // Debug log
  console.log('🔍 Checking balance for address:', senderAddress);
  console.log('📝 Contract address:', INTERBANK_TRANSFER_ADDRESS);
  
  try {
    const balance = await readContract.getBalance(senderAddress);
    const balanceVND = weiToVnd(balance);
    const balanceETH = ethers.formatEther(balance);
    
    console.log(`💰 Balance check: ${balanceVND.toLocaleString('vi-VN')} VND (${balanceETH} ETH)`);
    console.log(`💸 Amount needed: ${amountVND.toLocaleString('vi-VN')} VND (${ethers.formatEther(amountWei)} ETH)`);
    
    if (balance < amountWei) {
      throw new Error(
        `Số dư trong contract không đủ. ` +
        `Address: ${senderAddress} ` +
        `Số dư hiện tại: ${balanceVND.toLocaleString('vi-VN')} VND, ` +
        `Số tiền cần: ${amountVND.toLocaleString('vi-VN')} VND. ` +
        `Vui lòng deposit số dư vào contract cho address này.`
      );
    }
    console.log('✅ Balance check passed!');
  } catch (error: any) {
    // Nếu là lỗi số dư không đủ, throw ngay
    if (error.message && error.message.includes('Số dư trong contract không đủ')) {
      throw error;
    }
    // Nếu là lỗi khác (network, contract call, etc), log và throw để user biết
    console.error('❌ Error checking balance:', error);
    throw new Error(
      `Không thể kiểm tra số dư trong contract. Address: ${senderAddress}. ` +
      `Lỗi: ${error.message || 'Unknown error'}. ` +
      `Vui lòng thử lại sau.`
    );
  }

  // Get contract with signer for transfer
  const contract = getContractWithSigner(fromPrivateKey);
  
  // Call the transfer function using promise chain (similar to TransferQuorumToken pattern)
  return new Promise<{ txHash: string; txId: bigint }>((resolve, reject) => {
    contract.transfer(
      toAddress,
      amountWei,
      toBankCode,
      description,
      {
        gasLimit: 15000000, // Max gas limit for contract calls
        gasPrice: 0, // Free gas for private network
      }
    )
      .then(async (tx: ethers.ContractTransactionResponse) => {
        // In ethers v6, ContractTransactionResponse.hash might not be available immediately
        // We need to wait for the receipt to get the hash reliably
        console.log('📤 Transaction sent, waiting for receipt...');
        console.log('📤 Transaction object:', tx);
        console.log('📤 Transaction object keys:', Object.keys(tx));
        console.log('📤 Transaction object type:', typeof tx);
        console.log('📤 Transaction object toString:', tx.toString());
        
        // Try multiple ways to get hash from tx object
        let txHash: string | undefined = undefined;
        
        // Method 1: Direct hash property
        if ((tx as any).hash) {
          txHash = (tx as any).hash;
          console.log('✅ Got hash from tx.hash:', txHash);
        }
        
        // Method 2: transactionHash property
        if (!txHash && (tx as any).transactionHash) {
          txHash = (tx as any).transactionHash;
          console.log('✅ Got hash from tx.transactionHash:', txHash);
        }
        
        // Method 3: Try to access via getTransaction method
        if (!txHash) {
          try {
            const provider = getProvider();
            // Get transaction details from provider if possible
            const txDetails = await provider.getTransaction((tx as any).hash || (tx as any).transactionHash || '');
            if (txDetails && txDetails.hash) {
              txHash = txDetails.hash;
              console.log('✅ Got hash from provider.getTransaction:', txHash);
            }
          } catch (e) {
            console.log('⚠️ Could not get hash from provider:', e);
          }
        }
        
        // Wait for transaction receipt to get reliable hash (similar to TransferQuorumToken: tr.wait())
        try {
          console.log('⏳ Waiting for transaction receipt...');
          const receipt = await tx.wait(1);
          
          if (!receipt) {
            console.error('❌ No receipt received');
            if (txHash) {
              console.warn('⚠️ Using hash from tx object (no receipt):', txHash);
              resolve({
                txHash: txHash as string,
                txId: BigInt(0),
              });
              return;
            }
            reject(new Error('Không nhận được transaction receipt. Transaction có thể đã thất bại.'));
            return;
          }

          console.log('✅ Receipt received:', receipt);
          console.log('📋 Receipt type:', typeof receipt);
          console.log('📋 Receipt keys:', Object.keys(receipt));
          console.log('📋 Receipt hash:', receipt.hash);
          console.log('📋 Receipt transactionHash:', receipt.transactionHash);
          console.log('📋 Receipt toString:', receipt.toString());

          // Get hash from receipt (most reliable source)
          // Try multiple properties
          let finalTxHash: string | undefined = undefined;
          
          if (receipt.hash) {
            finalTxHash = receipt.hash;
            console.log('✅ Using receipt.hash:', finalTxHash);
          } else if (receipt.transactionHash) {
            finalTxHash = receipt.transactionHash;
            console.log('✅ Using receipt.transactionHash:', finalTxHash);
          } else if ((receipt as any).transaction?.hash) {
            finalTxHash = (receipt as any).transaction.hash;
            console.log('✅ Using receipt.transaction.hash:', finalTxHash);
          } else if (txHash) {
            finalTxHash = txHash;
            console.log('✅ Using txHash from tx object:', finalTxHash);
          }
          
          if (!finalTxHash) {
            console.error('❌ All methods failed to get hash');
            console.error('Receipt object:', JSON.stringify(receipt, null, 2));
            reject(new Error('Không thể lấy transaction hash từ receipt. Vui lòng kiểm tra console logs.'));
            return;
          }

          console.log('✅ Final transaction hash:', finalTxHash);

          // Check transaction status (1 = success, 0 = failed/reverted)
          if (receipt.status === 0 || receipt.status === null) {
            let revertReason = 'Transaction reverted on blockchain';
            if (receipt.logs && receipt.logs.length === 0) {
              revertReason = 'Transaction reverted: No events emitted (likely a revert)';
            }
            reject(new Error(revertReason));
            return;
          }

          console.log('✅ Transaction confirmed successfully, hash:', finalTxHash, 'status:', receipt.status);

          // Get transaction ID from Transfer event
          const transferEvent = receipt.logs.find((log: any) => {
            try {
              const parsedLog = contract.interface.parseLog(log);
              return parsedLog?.name === 'Transfer';
            } catch {
              return false;
            }
          });

          let txId: bigint = BigInt(0);
          if (transferEvent) {
            const parsedLog = contract.interface.parseLog(transferEvent);
            if (parsedLog) {
              txId = parsedLog.args.transactionId;
            }
          }

          console.log('✅ Transfer successful:', { txHash: finalTxHash, txId: txId.toString() });

          // Resolve with hash from receipt
          resolve({
            txHash: finalTxHash as string,
            txId,
          });
        } catch (waitError: any) {
          console.error('❌ Error waiting for transaction receipt:', waitError);
          console.error('Error details:', {
            message: waitError.message,
            stack: waitError.stack,
            name: waitError.name,
          });
          
          // If we can't get receipt but have a hash from tx, still resolve
          if (txHash) {
            console.warn('⚠️ Using hash from tx object (receipt wait failed):', txHash);
            resolve({
              txHash: txHash as string,
              txId: BigInt(0),
            });
          } else {
            reject(new Error(`Không thể lấy transaction hash: ${waitError.message || 'Unknown error'}`));
          }
        }
      })
      .catch((error: any) => {
        console.error('Error transferring via contract:', error);
        console.error('Error details:', {
          message: error.message,
          reason: error.reason,
          data: error.data,
          code: error.code,
        });
        
        // Improve error message for common issues
        if (error.reason || error.data) {
          const reason = error.reason || 'Transaction reverted';
          if (reason.includes('Insufficient balance')) {
            reject(new Error(
              'Số dư trong contract không đủ. Vui lòng deposit số dư vào contract trước khi chuyển tiền.'
            ));
            return;
          }
          reject(new Error(`Lỗi từ contract: ${reason}`));
          return;
        }
        
        reject(error);
      });
  });
};

/**
 * Transfer funds using smart contract with ZKP proof
 * Chứng minh balance > amount mà không tiết lộ giá trị balance
 */
export const transferWithZKP = async (
  fromPrivateKey: string,
  toAddress: string,
  amountVND: number,
  toBankCode: string,
  description: string,
  useZKP: boolean = true
): Promise<{ txHash: string; txId: bigint }> => {
  if (!(await isContractAvailable())) {
    throw new Error(
      'Smart contract chưa được triển khai hoặc NEXT_PUBLIC_CONTRACT_ADDRESS không chính xác. ' +
      'Vui lòng deploy contract và cập nhật địa chỉ trước khi thực hiện giao dịch.'
    );
  }

  const amountWei = vndToWei(amountVND);
  
  // Get wallet and address first
  const wallet = new ethers.Wallet(fromPrivateKey);
  const senderAddress = wallet.address;
  
  // Use read-only contract for balance check
  const readContract = getContract();
  
  // Get balance from contract
  let balance: bigint;
  try {
    balance = await readContract.getBalance(senderAddress);
    const balanceVND = weiToVnd(balance);
    const balanceETH = ethers.formatEther(balance);
    
    console.log(`💰 Balance check: ${balanceVND.toLocaleString('vi-VN')} VND (${balanceETH} ETH)`);
    console.log(`💸 Amount needed: ${amountVND.toLocaleString('vi-VN')} VND (${ethers.formatEther(amountWei)} ETH)`);
    
    if (balance < amountWei) {
      throw new Error(
        `Số dư trong contract không đủ. ` +
        `Address: ${senderAddress} ` +
        `Số dư hiện tại: ${balanceVND.toLocaleString('vi-VN')} VND, ` +
        `Số tiền cần: ${amountVND.toLocaleString('vi-VN')} VND. ` +
        `Vui lòng deposit số dư vào contract cho address này.`
      );
    }
    console.log('✅ Balance check passed!');
  } catch (error: any) {
    if (error.message && error.message.includes('Số dư trong contract không đủ')) {
      throw error;
    }
    console.error('❌ Error checking balance:', error);
    throw new Error(
      `Không thể kiểm tra số dư trong contract. Address: ${senderAddress}. ` +
      `Lỗi: ${error.message || 'Unknown error'}. ` +
      `Vui lòng thử lại sau.`
    );
  }

  // Generate ZKP proof if enabled
  let proofBytes: string = '0x';
  let commitmentHash: string = '0x0000000000000000000000000000000000000000000000000000000000000000';
  
  if (useZKP) {
    try {
      console.log('🔐 Generating ZKP proof for balance verification...');
      const zkpClient = getZKPClient();
      
      // Check ZKP service health
      const isHealthy = await zkpClient.healthCheck();
      if (!isHealthy) {
        console.warn('⚠️ ZKP Prover service is not available, falling back to regular transfer');
        return transferViaContract(fromPrivateKey, toAddress, amountVND, toBankCode, description);
      }
      
      // Generate secret nonce
      const secretNonce = ethers.randomBytes(32).toString('hex');
      
      // Generate balance commitment
      const balanceHex = balance.toString(16).padStart(16, '0');
      const balanceCommitment = `${balanceHex}${secretNonce}`;
      
      // Generate proof
      const proof = await zkpClient.generateBalanceProof(
        senderAddress,
        Number(amountVND),
        Number(balanceVND),
        secretNonce
      );
      
      // Convert proof bytes to hex string
      proofBytes = '0x' + proof.proof_bytes.map(b => b.toString(16).padStart(2, '0')).join('');
      commitmentHash = '0x' + proof.commitment_hash;
      
      console.log('✅ ZKP proof generated successfully');
      console.log(`   Proof size: ${proof.proof_bytes.length} bytes`);
      console.log(`   Commitment hash: ${commitmentHash.substring(0, 20)}...`);
    } catch (error: any) {
      console.error('❌ Error generating ZKP proof:', error);
      console.warn('⚠️ Falling back to regular transfer without ZKP');
      // Fallback to regular transfer
      return transferViaContract(fromPrivateKey, toAddress, amountVND, toBankCode, description);
    }
  }

  // Get contract with signer for transfer
  const contract = getContractWithSigner(fromPrivateKey);
  
  // Call transferWithZKP if ZKP is enabled, otherwise use regular transfer
  if (useZKP && proofBytes !== '0x') {
    return new Promise<{ txHash: string; txId: bigint }>((resolve, reject) => {
      contract.transferWithZKP(
        toAddress,
        amountWei,
        toBankCode,
        description,
        amountWei, // proofAmount
        commitmentHash,
        proofBytes,
        {
          gasLimit: 15000000,
          gasPrice: 0,
        }
      )
        .then(async (tx: ethers.ContractTransactionResponse) => {
          console.log('📤 ZKP Transaction sent, waiting for receipt...');
          
          try {
            const receipt = await tx.wait(1);
            if (!receipt) {
              reject(new Error('Không nhận được transaction receipt.'));
              return;
            }

            const finalTxHash = receipt.hash || receipt.transactionHash || (tx as any).hash;
            if (!finalTxHash) {
              reject(new Error('Không thể lấy transaction hash.'));
              return;
            }

            // Get transaction ID from events
            let txId = BigInt(0);
            if (receipt.logs && receipt.logs.length > 0) {
              // Try to decode Transfer event to get transaction ID
              try {
                const transferEvent = receipt.logs.find((log: any) => {
                  try {
                    const parsed = contract.interface.parseLog(log);
                    return parsed && parsed.name === 'Transfer';
                  } catch {
                    return false;
                  }
                });
                
                if (transferEvent) {
                  const parsed = contract.interface.parseLog(transferEvent);
                  if (parsed && parsed.args && parsed.args[0]) {
                    txId = BigInt(parsed.args[0].toString());
                  }
                }
              } catch (e) {
                console.warn('Could not extract transaction ID from events:', e);
              }
            }

            console.log('✅ ZKP Transaction confirmed:', finalTxHash);
            resolve({
              txHash: finalTxHash,
              txId,
            });
          } catch (waitError: any) {
            console.error('❌ Error waiting for transaction receipt:', waitError);
            reject(new Error(`Không thể lấy transaction hash: ${waitError.message || 'Unknown error'}`));
          }
        })
        .catch((error: any) => {
          console.error('Error transferring with ZKP:', error);
          if (error.reason || error.data) {
            const reason = error.reason || 'Transaction reverted';
            reject(new Error(`Lỗi từ contract: ${reason}`));
            return;
          }
          reject(error);
        });
    });
  } else {
    // Fallback to regular transfer
    return transferViaContract(fromPrivateKey, toAddress, amountVND, toBankCode, description);
  }
};

/**
 * Withdraw funds from smart contract
 */
export const withdrawViaContract = async (
  fromPrivateKey: string,
  amountVND: number,
  description: string
): Promise<{ txHash: string; txId: bigint }> => {
  if (!(await isContractAvailable())) {
    throw new Error(
      'Smart contract chưa được triển khai hoặc NEXT_PUBLIC_CONTRACT_ADDRESS không chính xác. ' +
      'Vui lòng deploy contract và cập nhật địa chỉ trước khi thực hiện rút tiền.'
    );
  }

  const amountWei = vndToWei(amountVND);
  
  // Get wallet and address first
  const wallet = new ethers.Wallet(fromPrivateKey);
  const senderAddress = wallet.address;
  
  // Use read-only contract for balance check
  const readContract = getContract();
  
  try {
    const balance = await readContract.getBalance(senderAddress);
    const balanceVND = weiToVnd(balance);
    const balanceETH = ethers.formatEther(balance);
    
    console.log(`💰 Withdraw - Balance check: ${balanceVND.toLocaleString('vi-VN')} VND (${balanceETH} ETH)`);
    console.log(`💸 Withdraw - Amount needed: ${amountVND.toLocaleString('vi-VN')} VND (${ethers.formatEther(amountWei)} ETH)`);
    
    if (balance < amountWei) {
      throw new Error(
        `Số dư trong contract không đủ. ` +
        `Address: ${senderAddress} ` +
        `Số dư hiện tại: ${balanceVND.toLocaleString('vi-VN')} VND, ` +
        `Số tiền cần: ${amountVND.toLocaleString('vi-VN')} VND.`
      );
    }
    console.log('✅ Withdraw - Balance check passed!');
  } catch (error: any) {
    if (error.message && error.message.includes('Số dư trong contract không đủ')) {
      throw error;
    }
    console.error('❌ Error checking balance:', error);
    throw new Error(
      `Không thể kiểm tra số dư trong contract. Address: ${senderAddress}. ` +
      `Lỗi: ${error.message || 'Unknown error'}.`
    );
  }

  // Get contract with signer for withdraw
  const contract = getContractWithSigner(fromPrivateKey);
  
  // Call the withdraw function
  try {
    const tx = await contract.withdraw(
      amountWei,
      description,
      {
        gasLimit: 15000000,
        gasPrice: 0,
      }
    );

    // Get transaction hash immediately (available right after sending)
    const txHash = tx.hash;
    
    if (!txHash) {
      throw new Error('Không thể lấy transaction hash. Transaction có thể chưa được gửi thành công.');
    }

    console.log('📤 Withdraw transaction sent, hash:', txHash);

    // Wait for transaction receipt
    const receipt = await tx.wait(1);

    // Check if transaction was successful
    if (!receipt) {
      throw new Error('Không nhận được transaction receipt. Transaction có thể đã thất bại.');
    }

    // Check transaction status (1 = success, 0 = failed/reverted)
    if (receipt.status === 0 || receipt.status === null) {
      // Try to get revert reason if available
      let revertReason = 'Transaction reverted on blockchain';
      try {
        // Try to decode revert reason from receipt
        if (receipt.logs && receipt.logs.length === 0) {
          revertReason = 'Transaction reverted: No events emitted (likely a revert)';
        }
      } catch (e) {
        console.error('Error parsing revert reason:', e);
      }
      throw new Error(revertReason);
    }

    // Verify receipt has the same hash
    const receiptHash = receipt?.hash || receipt?.transactionHash;
    if (receiptHash && receiptHash !== txHash) {
      console.warn('⚠️ Receipt hash differs from tx hash:', { txHash, receiptHash });
    }

    console.log('✅ Withdraw transaction confirmed successfully, hash:', txHash, 'status:', receipt.status);

    // Get transaction ID from Transfer event
    const transferEvent = receipt.logs.find((log: any) => {
      try {
        const parsedLog = contract.interface.parseLog(log);
        return parsedLog?.name === 'Transfer';
      } catch {
        return false;
      }
    });

    let txId: bigint = BigInt(0);
    if (transferEvent) {
      const parsedLog = contract.interface.parseLog(transferEvent);
      if (parsedLog) {
        txId = parsedLog.args.transactionId;
      }
    }

    console.log('✅ Withdraw successful:', { txHash, txId: txId.toString() });

    return {
      txHash: txHash as string,
      txId,
    };
  } catch (error: any) {
    console.error('Error withdrawing via contract:', error);
    
    if (error.reason || error.data) {
      const reason = error.reason || 'Transaction reverted';
      if (reason.includes('Insufficient balance')) {
        throw new Error(
          'Số dư trong contract không đủ. Vui lòng kiểm tra số dư trước khi rút tiền.'
        );
      }
      if (reason.includes('KYC not valid')) {
        throw new Error(
          'KYC chưa được xác minh hoặc đã hết hạn. Vui lòng liên hệ ngân hàng để xác minh KYC.'
        );
      }
      throw new Error(`Lỗi từ contract: ${reason}`);
    }
    
    throw error;
  }
};

/**
 * Get transaction details from contract
 */
export const getContractTransaction = async (txId: bigint) => {
  try {
    if (!(await isContractAvailable())) {
      console.warn('Skipping getContractTransaction because contract is not deployed.');
      return null;
    }

    const contract = getContract();
    const tx = await contract.getTransaction(txId);
    return {
      id: tx.id.toString(),
      from: tx.from,
      to: tx.to,
      amount: weiToVnd(tx.amount),
      amountWei: tx.amount.toString(),
      fromBank: tx.fromBank,
      toBank: tx.toBank,
      description: tx.description,
      timestamp: new Date(Number(tx.timestamp) * 1000),
      status: tx.status, // 0: Pending, 1: Processing, 2: Completed, 3: Failed
    };
  } catch (error: any) {
    console.error('Error getting transaction from contract:', error);
    return null;
  }
};

/**
 * Get user transactions from contract
 */
export const getUserContractTransactions = async (userAddress: string): Promise<bigint[]> => {
  try {
    if (!(await isContractAvailable())) {
      console.warn('Skipping getUserContractTransactions because contract is not deployed.');
      return [];
    }

    const contract = getContract();
    const txIds = await contract.getUserTransactions(userAddress);
    return txIds.map((id: bigint) => id);
  } catch (error: any) {
    console.error('Error getting user transactions from contract:', error);
    return [];
  }
};

/**
 * Listen to Transfer events
 */
export const listenToTransferEvents = (
  callback: (event: {
    txId: bigint;
    from: string;
    to: string;
    amount: number;
    fromBank: string;
    toBank: string;
    description: string;
    timestamp: Date;
  }) => void
) => {
  try {
    const contract = getContract();

    // Listen to Transfer events
    contract.on('Transfer', (txId, from, to, amount, fromBank, toBank, description, timestamp) => {
      callback({
        txId,
        from,
        to,
        amount: weiToVnd(amount),
        fromBank,
        toBank,
        description,
        timestamp: new Date(Number(timestamp) * 1000),
      });
    });

    // Return cleanup function
    return () => {
      contract.removeAllListeners('Transfer');
    };
  } catch (error: any) {
    console.error('Error setting up event listener:', error);
    return () => {}; // Return empty cleanup function
  }
};

/**
 * Check if contract is deployed and accessible
 */
export const isContractDeployed = async (): Promise<boolean> => {
  try {
    return await isContractAvailable();
  } catch {
    return false;
  }
};

/**
 * Transfer funds using smart contract with PQC signature (lưu signature on-chain)
 * @param fromPrivateKey Private key của người gửi
 * @param toAddress Địa chỉ người nhận
 * @param amountVND Số tiền (VND)
 * @param toBankCode Mã ngân hàng nhận
 * @param description Mô tả giao dịch
 * @param usePQC Có sử dụng PQC signature không (default: true)
 * @param entityId Entity ID để sign với KSM (default: từ address)
 * @return Transaction hash và ID
 */
export const transferWithPQC = async (
  fromPrivateKey: string,
  toAddress: string,
  amountVND: number,
  toBankCode: string,
  description: string,
  usePQC: boolean = true,
  entityId?: string
): Promise<{ txHash: string; txId: bigint }> => {
  if (!(await isContractAvailable())) {
    throw new Error(
      'Smart contract chưa được triển khai hoặc NEXT_PUBLIC_CONTRACT_ADDRESS không chính xác. ' +
      'Vui lòng deploy contract và cập nhật địa chỉ trước khi thực hiện giao dịch.'
    );
  }

  const amountWei = vndToWei(amountVND);
  
  // Get wallet and address first
  const wallet = new ethers.Wallet(fromPrivateKey);
  const senderAddress = wallet.address;
  
  // Use read-only contract for balance check
  const readContract = getContract();
  
  // Check balance
  try {
    const balance = await readContract.getBalance(senderAddress);
    const balanceVND = weiToVnd(balance);
    
    if (balance < amountWei) {
      throw new Error(
        `Số dư trong contract không đủ. ` +
        `Address: ${senderAddress} ` +
        `Số dư hiện tại: ${balanceVND.toLocaleString('vi-VN')} VND, ` +
        `Số tiền cần: ${amountVND.toLocaleString('vi-VN')} VND.`
      );
    }
    console.log('✅ Balance check passed!');
  } catch (error: any) {
    if (error.message && error.message.includes('Số dư trong contract không đủ')) {
      throw error;
    }
    console.error('❌ Error checking balance:', error);
    throw new Error(`Không thể kiểm tra số dư: ${error.message || 'Unknown error'}`);
  }

  // Generate PQC signature if enabled
  let pqcSignature: string = '';
  let algorithm: string = 'Dilithium3';
  
  if (usePQC) {
    try {
      console.log('🔐 Generating PQC signature...');
      const ksmClient = getKSMClient();
      
      // Check KSM health
      const isHealthy = await ksmClient.healthCheck();
      if (!isHealthy) {
        console.warn('⚠️ KSM service is not available, falling back to regular transfer');
        return transferViaContract(fromPrivateKey, toAddress, amountVND, toBankCode, description);
      }
      
      // Use entityId or derive from address
      const finalEntityId = entityId || senderAddress.toLowerCase().substring(0, 10);
      
      // Create message to sign: address + to + amount + timestamp
      const message = JSON.stringify({
        from: senderAddress,
        to: toAddress,
        amount: amountVND.toString(),
        toBankCode,
        description,
        timestamp: Date.now()
      });
      
      // Sign with KSM
      const signatureResult = await ksmClient.sign(finalEntityId, message);
      pqcSignature = signatureResult.signature;
      algorithm = signatureResult.algorithm || 'Dilithium3';
      
      console.log('✅ PQC signature generated:', {
        algorithm,
        signatureSize: signatureResult.signatureSize,
        signaturePreview: pqcSignature.substring(0, 50) + '...'
      });
    } catch (error: any) {
      console.error('❌ Error generating PQC signature:', error);
      console.warn('⚠️ Falling back to regular transfer without PQC');
      return transferViaContract(fromPrivateKey, toAddress, amountVND, toBankCode, description);
    }
  }

  // Get contract with signer for transfer
  const contract = getContractWithSigner(fromPrivateKey);
  
  // Call transferWithPQC if PQC signature available, otherwise use regular transfer
  if (usePQC && pqcSignature) {
    // Convert Base64 signature to bytes
    // Note: KSM returns Base64, but we need to decode it to bytes
    let signatureBytes: Uint8Array;
    try {
      // Try to decode Base64
      signatureBytes = Uint8Array.from(atob(pqcSignature), c => c.charCodeAt(0));
    } catch {
      // If not Base64, treat as hex string
      signatureBytes = ethers.getBytes(pqcSignature);
    }
    
    return new Promise<{ txHash: string; txId: bigint }>((resolve, reject) => {
      contract.transferWithPQC(
        toAddress,
        amountWei,
        toBankCode,
        description,
        signatureBytes,
        algorithm,
        {
          gasLimit: 2000000, // Higher gas limit for PQC signature storage
          gasPrice: 0,
        }
      )
        .then(async (tx: ethers.ContractTransactionResponse) => {
          console.log('📤 PQC Transaction sent, waiting for receipt...');
          
          try {
            const receipt = await tx.wait(1);
            if (!receipt) {
              reject(new Error('Không nhận được transaction receipt.'));
              return;
            }

            const finalTxHash = receipt.hash || receipt.transactionHash || (tx as any).hash;
            if (!finalTxHash) {
              reject(new Error('Không thể lấy transaction hash.'));
              return;
            }

            // Get transaction ID from events
            let txId = BigInt(0);
            if (receipt.logs && receipt.logs.length > 0) {
              try {
                const transferEvent = receipt.logs.find((log: any) => {
                  try {
                    const parsed = contract.interface.parseLog(log);
                    return parsed && (parsed.name === 'Transfer' || parsed.name === 'TransferWithPQC');
                  } catch {
                    return false;
                  }
                });
                
                if (transferEvent) {
                  const parsed = contract.interface.parseLog(transferEvent);
                  if (parsed && parsed.args && parsed.args[0]) {
                    txId = BigInt(parsed.args[0].toString());
                  }
                }
              } catch (e) {
                console.warn('Could not extract transaction ID from events:', e);
              }
            }

            console.log('✅ PQC Transaction confirmed:', finalTxHash);
            console.log('🔐 PQC Signature stored on-chain for transaction:', txId.toString());
            resolve({
              txHash: finalTxHash,
              txId,
            });
          } catch (waitError: any) {
            console.error('❌ Error waiting for transaction receipt:', waitError);
            reject(new Error(`Không thể lấy transaction hash: ${waitError.message || 'Unknown error'}`));
          }
        })
        .catch((error: any) => {
          console.error('Error transferring with PQC:', error);
          if (error.reason || error.data) {
            const reason = error.reason || 'Transaction reverted';
            reject(new Error(`Lỗi từ contract: ${reason}`));
            return;
          }
          reject(error);
        });
    });
  } else {
    // Fallback to regular transfer
    return transferViaContract(fromPrivateKey, toAddress, amountVND, toBankCode, description);
  }
};

