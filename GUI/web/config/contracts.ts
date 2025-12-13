// Contract ABI and configuration
import contractData from './contracts/InterbankTransfer.json';

// Extract ABI from the compiled contract JSON
export const PKI_REGISTRY_ADDRESS = '0x7cA5543f9B2C35F0E972f1B45b61A2FE53fF1ed9';

export const INTERBANK_TRANSFER_ABI = contractData.abi;

// Contract address will be set after deployment
// Can be set via environment variable: NEXT_PUBLIC_CONTRACT_ADDRESS
// Deployed contract address (updated automatically by deploy_and_init.js)
export const INTERBANK_TRANSFER_ADDRESS = 
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0xDE87AF9156a223404885002669D3bE239313Ae33';

// Transaction status enum (matching Solidity enum)
export enum TransactionStatus {
  Pending = 0,
  Processing = 1,
  Completed = 2,
  Failed = 3,
}

