// Local storage utilities for transactions and user data

import { Transaction } from '@/types/transaction';
import { auditPKIRegister, auditKYCVerify, auditAuthorizationSet } from './audit';

const STORAGE_KEYS = {
  TRANSACTIONS_PREFIX: 'interbank_transactions_', // Prefix for user-specific transactions
  SELECTED_USER: 'interbank_selected_user',
  SELECTED_BANK: 'interbank_selected_bank',
};

// Get storage key for a specific user (using bank and address as identifier)
export const getUserTransactionsKey = (bankCode: string, address: string): string => {
  return `${STORAGE_KEYS.TRANSACTIONS_PREFIX}${bankCode.toLowerCase()}_${address.toLowerCase()}`;
};

/**
 * Find bank code for a given address
 */
export const findBankCodeByAddress = (address: string): string | null => {
  // Import here to avoid circular dependency
  const { getAllUsers, BANKS } = require('@/config/banks');
  const allUsers = getAllUsers();
  const user = allUsers.find((u: any) => u.address.toLowerCase() === address.toLowerCase());
  if (user) {
    // Find bank code by searching through all banks
    for (const bank of BANKS) {
      const foundUser = bank.users.find((u: any) => u.id === user.id);
      if (foundUser) {
        return bank.code;
      }
    }
  }
  return null;
};

export const saveTransaction = (transaction: Transaction, bankCode: string, userAddress: string): void => {
  const userKey = getUserTransactionsKey(bankCode, userAddress);
  const transactions = getTransactionsByUser(bankCode, userAddress);
  
  // Check for duplicate transaction
  // Duplicate is defined as: same id, same from, same to, same timestamp (within 1 second), same txHash (if exists)
  const isDuplicate = transactions.some((tx) => {
    const sameId = tx.id === transaction.id;
    const sameFrom = tx.from.toLowerCase() === transaction.from.toLowerCase();
    const sameTo = tx.to.toLowerCase() === transaction.to.toLowerCase();
    const sameTxHash = (tx.txHash && transaction.txHash && tx.txHash === transaction.txHash) || 
                       (!tx.txHash && !transaction.txHash);
    const sameTimestamp = Math.abs(tx.timestamp.getTime() - transaction.timestamp.getTime()) < 1000; // Within 1 second
    
    // If all match, it's a duplicate
    return sameId && sameFrom && sameTo && sameTimestamp && sameTxHash;
  });
  
  // Only add if not duplicate
  if (!isDuplicate) {
    transactions.unshift(transaction);
    localStorage.setItem(userKey, JSON.stringify(transactions));
  } else {
    console.log(`⚠️ Duplicate transaction skipped: ${transaction.id}`, transaction);
  }
};

/**
 * Save transaction for both sender and receiver
 */
export const saveTransactionForBoth = (transaction: Transaction, senderBankCode: string, senderAddress: string): void => {
  // Save for sender
  saveTransaction(transaction, senderBankCode, senderAddress);
  
  // Save for receiver (if receiver is a known user in the system)
  const receiverBankCode = findBankCodeByAddress(transaction.to);
  if (receiverBankCode) {
    // Create a copy of transaction for receiver (same transaction, different perspective)
    const receiverTransaction: Transaction = {
      ...transaction,
      // Keep all fields the same - receiver will see it as incoming transaction
    };
    saveTransaction(receiverTransaction, receiverBankCode, transaction.to);
    console.log(`✅ Transaction ${transaction.id} saved for receiver ${transaction.to.substring(0, 10)}... in bank ${receiverBankCode}`);
  } else {
    console.log(`ℹ️ Receiver ${transaction.to.substring(0, 10)}... is not a known user, skipping receiver transaction save`);
  }
};

export const getTransactions = (): Transaction[] => {
  // This is deprecated - use getTransactionsByUser instead
  // Kept for backward compatibility
  return [];
};

export const getTransactionsByUser = (bankCode: string, address: string): Transaction[] => {
  const userKey = getUserTransactionsKey(bankCode, address);
  const data = localStorage.getItem(userKey);
  if (!data) return [];
  try {
    const transactions = JSON.parse(data);
    return transactions.map((tx: any) => ({
      ...tx,
      timestamp: new Date(tx.timestamp),
    }));
  } catch {
    return [];
  }
};

export const deleteTransactionsByUser = (bankCode: string, address: string): void => {
  const userKey = getUserTransactionsKey(bankCode, address);
  localStorage.removeItem(userKey);
};

export const deleteTransaction = (bankCode: string, address: string, transactionId: string): void => {
  const transactions = getTransactionsByUser(bankCode, address);
  const filtered = transactions.filter((tx) => tx.id !== transactionId);
  const userKey = getUserTransactionsKey(bankCode, address);
  localStorage.setItem(userKey, JSON.stringify(filtered));
};

export const getTransactionsByBank = (bankCode: string): Transaction[] => {
  const transactions = getTransactions();
  return transactions.filter(
    (tx) =>
      tx.fromBank.toLowerCase() === bankCode.toLowerCase() ||
      tx.toBank?.toLowerCase() === bankCode.toLowerCase()
  );
};

export const updateTransactionStatus = (
  bankCode: string,
  userAddress: string,
  txHashOrId: string,
  status: Transaction['status'],
  blockNumber?: number,
  newTxHash?: string
): void => {
  const transactions = getTransactionsByUser(bankCode, userAddress);
  const index = transactions.findIndex(
    (tx) => tx.txHash === txHashOrId || tx.id === txHashOrId
  );
  if (index !== -1) {
    transactions[index].status = status;
    if (blockNumber) {
      transactions[index].blockNumber = blockNumber;
    }
    if (newTxHash) {
      transactions[index].txHash = newTxHash;
    }
    const userKey = getUserTransactionsKey(bankCode, userAddress);
    localStorage.setItem(userKey, JSON.stringify(transactions));
  }
};

export const generateReferenceCode = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REF-${timestamp}-${random}`;
};

export const setSelectedUser = (userId: string): void => {
  localStorage.setItem(STORAGE_KEYS.SELECTED_USER, userId);
};

export const getSelectedUser = (): string | null => {
  return localStorage.getItem(STORAGE_KEYS.SELECTED_USER);
};

export const setSelectedBank = (bankCode: string): void => {
  localStorage.setItem(STORAGE_KEYS.SELECTED_BANK, bankCode);
};

export const getSelectedBank = (): string | null => {
  return localStorage.getItem(STORAGE_KEYS.SELECTED_BANK);
};

// Balance storage functions
const BALANCE_KEY_PREFIX = 'interbank_balance_';

export const saveUserBalance = (address: string, balance: number): void => {
  localStorage.setItem(
    `${BALANCE_KEY_PREFIX}${address.toLowerCase()}`,
    balance.toString()
  );
};

export const getStoredBalance = (address: string): number | null => {
  const stored = localStorage.getItem(`${BALANCE_KEY_PREFIX}${address.toLowerCase()}`);
  return stored ? parseFloat(stored) : null;
};

export const clearUserBalance = (address: string): void => {
  localStorage.removeItem(`${BALANCE_KEY_PREFIX}${address.toLowerCase()}`);
};

