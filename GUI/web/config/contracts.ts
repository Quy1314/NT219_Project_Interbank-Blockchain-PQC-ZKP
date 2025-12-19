// Contract ABI and configuration
import contractData from './contracts/InterbankTransfer.json';

// Extract ABI from the compiled contract JSON
export const PKI_REGISTRY_ADDRESS = '0x43D1F9096674B5722D359B6402381816d5B22F28';

export const INTERBANK_TRANSFER_ABI = contractData.abi;

// Contract address will be set after deployment
// Can be set via environment variable: NEXT_PUBLIC_CONTRACT_ADDRESS
// Deployed contract address (updated automatically by deploy_and_init.js)
export const INTERBANK_TRANSFER_ADDRESS = 
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x42699A7612A82f1d9C36148af9C77354759b210b';

// Transaction status enum (matching Solidity enum)
export enum TransactionStatus {
  Pending = 0,
  Processing = 1,
  Completed = 2,
  Failed = 3,
}

