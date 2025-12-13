// Smart Contract interaction utilities
import { ethers } from 'ethers';
import { getProvider } from './blockchain';
import { vndToWei, weiToVnd } from '@/config/blockchain';
import { INTERBANK_TRANSFER_ABI, INTERBANK_TRANSFER_ADDRESS } from '@/config/contracts';

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
  
  // Call the transfer function
  try {
    const tx = await contract.transfer(
      toAddress,
      amountWei,
      toBankCode,
      description,
      {
        gasLimit: 15000000, // Max gas limit for contract calls
        gasPrice: 0, // Free gas for private network
      }
    );

    // Wait for transaction receipt
    const receipt = await tx.wait(1);

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

    return {
      txHash: tx.hash,
      txId,
    };
  } catch (error: any) {
    console.error('Error transferring via contract:', error);
    
    // Improve error message for common issues
    if (error.reason || error.data) {
      // Contract revert reason
      const reason = error.reason || 'Transaction reverted';
      if (reason.includes('Insufficient balance')) {
        throw new Error(
          'Số dư trong contract không đủ. Vui lòng deposit số dư vào contract trước khi chuyển tiền.'
        );
      }
      throw new Error(`Lỗi từ contract: ${reason}`);
    }
    
    // Re-throw original error if we can't improve it
    throw error;
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

    // Wait for transaction receipt
    const receipt = await tx.wait(1);

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

    return {
      txHash: tx.hash,
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

