import { ethers } from 'ethers';
import { RPC_ENDPOINT, CHAIN_ID, vndToWei, weiToVnd, MOCK_MODE } from '@/config/blockchain';

let provider: ethers.JsonRpcProvider | null = null;

export const getProvider = (): ethers.JsonRpcProvider => {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(RPC_ENDPOINT, {
      chainId: CHAIN_ID,
      name: 'Interbank Network',
    });
  }
  return provider;
};

export const getWallet = (privateKey: string): ethers.Wallet => {
  const provider = getProvider();
  return new ethers.Wallet(privateKey, provider);
};

export const getBalance = async (address: string): Promise<bigint | null> => {
  try {
    const provider = getProvider();
    const balance = await provider.getBalance(address);
    return balance;
  } catch (error: any) {
    console.error('Error getting balance from blockchain:', error);
    // Return null if network error - let caller handle fallback
    return null;
  }
};

export const getBalanceVND = async (address: string): Promise<number | null> => {
  try {
    const balance = await getBalance(address);
    if (balance === null) {
      return null; // Blockchain unavailable
    }
    return weiToVnd(balance);
  } catch (error: any) {
    console.error('Error converting balance to VND:', error);
    return null; // Return null instead of throwing
  }
};

export const sendTransaction = async (
  fromPrivateKey: string,
  toAddress: string,
  amountVND: number,
  description?: string
): Promise<ethers.TransactionResponse> => {
  const wallet = getWallet(fromPrivateKey);
  const provider = getProvider();
  const amountWei = vndToWei(amountVND);

  // Check balance first
  const balance = await provider.getBalance(wallet.address);
  
  // For test network with min-gas-price=0, gas is free
  const gasPrice = BigInt(0);
  const gasLimit = BigInt(15000000); // Max gas limit (block limit is 16,243,360)
  const gasCost = gasLimit * gasPrice; // Will be 0
  
  // Check if balance is sufficient (amount + gas)
  if (balance < amountWei + gasCost) {
    // MOCK MODE: Trả về transaction giả lập nếu không đủ tiền (cho demo/test)
    if (MOCK_MODE) {
      console.warn(
        "⚠️ CẢNH BÁO: Số dư thực tế trên Blockchain không đủ. " +
        "Đang kích hoạt chế độ GIẢ LẬP (MOCK) để test UI."
      );

      // Tạo mock transaction hash
      const mockTxHash = `0xMOCK_TX_HASH_${Date.now().toString(16)}_${Math.random().toString(16).substring(2)}`;
      
      // Trả về một object giả lập TransactionResponse
      return {
        hash: mockTxHash,
        confirmations: 1,
        from: wallet.address,
        wait: async () => ({
          to: toAddress,
          from: wallet.address,
          contractAddress: null,
          transactionIndex: 0,
          gasUsed: gasLimit,
          logsBloom: "",
          blockHash: `0xMOCK_BLOCK_HASH_${Date.now().toString(16)}`,
          transactionHash: mockTxHash,
          logs: [],
          blockNumber: Math.floor(Math.random() * 1000000) + 1000000, // Random block number
          confirmations: 1,
          cumulativeGasUsed: gasLimit,
          effectiveGasPrice: gasPrice,
          byzantium: true,
          type: 2,
          status: 1, // 1 = Success
        }),
      } as any;
    }

    // Nếu không phải MOCK_MODE, throw error như bình thường
    const balanceVND = weiToVnd(balance);
    const gasCostVND = weiToVnd(gasCost);
    throw new Error(
      `Số dư không đủ. Số dư hiện tại: ${balanceVND.toLocaleString('vi-VN')} VND, ` +
      `Số tiền cần: ${amountVND.toLocaleString('vi-VN')} VND + phí gas: ${gasCostVND.toLocaleString('vi-VN')} VND`
    );
  }

  // Send transaction with explicit gas price (0 for test network)
  const tx = await wallet.sendTransaction({
    to: toAddress,
    value: amountWei,
    gasLimit: Number(gasLimit),
    gasPrice: 0, // Free gas for test network
  });

  return tx;
};

export const waitForTransaction = async (
  txHash: string
): Promise<ethers.TransactionReceipt | null> => {
  // Nếu là mock transaction hash, return mock receipt ngay lập tức
  if (txHash.startsWith('0xMOCK_TX_HASH_')) {
    const mockReceipt = {
      to: '',
      from: '',
      contractAddress: null,
      transactionIndex: 0,
      gasUsed: BigInt(21000),
      logsBloom: '',
      blockHash: `0xMOCK_BLOCK_HASH_${Date.now().toString(16)}`,
      transactionHash: txHash,
      logs: [],
      blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
      confirmations: 1,
      cumulativeGasUsed: BigInt(21000),
      effectiveGasPrice: BigInt(0),
      byzantium: true,
      type: 2,
      status: 1, // Success
    } as ethers.TransactionReceipt;
    
    return mockReceipt;
  }
  
  const provider = getProvider();
  return await provider.waitForTransaction(txHash);
};

export const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Removed - moved to storage.ts

