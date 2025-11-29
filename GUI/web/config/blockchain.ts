// Blockchain RPC configuration
// Note: If rpcnode container is running, use port 8545
// Otherwise, use port 21001 (sbv container)
// You can check which ports are available with: docker ps --filter "publish=8545"
export const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'http://localhost:21001';
export const WS_ENDPOINT = process.env.NEXT_PUBLIC_WS_ENDPOINT || 'ws://localhost:8546';

// Chain ID for the private network (from genesis)
export const CHAIN_ID = 1337;

// Gas configuration
// Block gas limit from genesis.json: 0xf7b760 = 16,243,360
// Max transaction gas limit set to 15,000,000 (safe margin below block limit)
export const GAS_LIMIT = 15000000; // Max gas limit for transactions
export const GAS_PRICE = '0x0'; // Free gas for test network

// Mock Mode: Set to true to enable mock transactions when blockchain balance is insufficient
// Useful for demo/testing without real blockchain setup
// WARNING: This will simulate successful transactions even with 0 balance!
export const MOCK_MODE = true;

// VND to Wei conversion
// Contract balance: 100 ETH = 100,000,000 VND (100 triệu) - mỗi user có 100 ETH trong contract
// So: 1 ETH = 1,000,000 VND for display purposes
export const WEI_TO_ETH = BigInt(10 ** 18);
export const ETH_TO_VND_RATE = 1000000; // 1 ETH = 1,000,000 VND (để 100 ETH = 100 triệu VND)
export const INITIAL_ETH_BALANCE = 100; // 100 ETH trong contract (tương đương 100 triệu VND)
export const INITIAL_VND_BALANCE = 100000000; // 100,000,000 VND (100 triệu)

export const vndToWei = (vnd: number): bigint => {
  // Convert VND to ETH: 100M VND = 100 ETH, so 1 VND = 0.000001 ETH = 10^12 wei
  // Formula: vnd / 1,000,000 = ETH, sau đó convert sang wei
  const ethValue = Number(vnd) / ETH_TO_VND_RATE; // Convert VND to ETH
  return BigInt(Math.floor(ethValue * Number(WEI_TO_ETH))); // Convert ETH to wei
};

export const weiToVnd = (wei: bigint): number => {
  // Convert Wei to ETH, sau đó convert ETH to VND
  // Rate: 1 ETH = 1,000,000 VND
  const ethValue = Number(wei) / Number(WEI_TO_ETH); // Convert wei to ETH
  return Math.floor(ethValue * ETH_TO_VND_RATE); // Convert ETH to VND
};

export const formatVND = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
};

// Blockchain Explorer URL (for local Besu network)
// If you have a local explorer like Blockscout, update this URL
export const getBlockchainExplorerUrl = (type: 'tx' | 'address' | 'block', value: string): string => {
  // For local Besu network, you can use:
  // - BlockScout: http://localhost:4000 (if installed)
  // - Besu JSON-RPC directly: Not recommended for user-facing links
  // - Custom explorer URL from env
  const explorerBaseUrl = process.env.NEXT_PUBLIC_BLOCKCHAIN_EXPLORER_URL || 'http://localhost:4000';
  
  switch (type) {
    case 'tx':
      return `${explorerBaseUrl}/tx/${value}`;
    case 'address':
      return `${explorerBaseUrl}/address/${value}`;
    case 'block':
      return `${explorerBaseUrl}/block/${value}`;
    default:
      return '#';
  }
};
