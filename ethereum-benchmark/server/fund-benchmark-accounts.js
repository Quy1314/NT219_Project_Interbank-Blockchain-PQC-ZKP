#!/usr/bin/env node

/**
 * Script to fund multiple accounts for benchmark
 * Generates accounts and funds them with ETH from owner account
 */

const Web3 = require('web3');
const https = require('https');
const crypto = require('crypto');

// Config
const RPC_URL = process.env.RPC_ENDPOINT || 'https://localhost:21001';
const OWNER_PRIVATE_KEY = process.env.PRIVATE_KEY || '0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63';
const FUND_AMOUNT_ETH = process.env.FUND_AMOUNT_ETH || '10'; // 10 ETH per account
const NUM_ACCOUNTS = parseInt(process.env.NUM_ACCOUNTS || '100'); // Generate 100 accounts

// Disable SSL verification for localhost
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Setup Web3
let provider;
if (RPC_URL.startsWith('https://')) {
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false
  });
  provider = new Web3.providers.HttpProvider(RPC_URL, { agent: httpsAgent });
} else {
  provider = new Web3.providers.HttpProvider(RPC_URL);
}

const web3 = new Web3(provider);
const ownerWallet = web3.eth.accounts.privateKeyToAccount(OWNER_PRIVATE_KEY);
web3.eth.accounts.wallet.add(ownerWallet);

// Generate random private key
function generateRandomPrivateKey() {
  return '0x' + crypto.randomBytes(32).toString('hex');
}

// Fund account with nonce management
async function fundAccount(privateKey, index, nonce) {
  try {
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    const address = account.address;
    
    // Get owner balance
    const ownerBalance = await web3.eth.getBalance(ownerWallet.address);
    const fundAmountWei = web3.utils.toWei(FUND_AMOUNT_ETH, 'ether');
    
    if (ownerBalance < fundAmountWei) {
      console.log(`⚠️  Owner balance insufficient: ${web3.utils.fromWei(ownerBalance, 'ether')} ETH`);
      return null;
    }
    
    // Create transaction with provided nonce
    const tx = {
      from: ownerWallet.address,
      to: address,
      value: fundAmountWei,
      gas: 21000,
      gasPrice: 0, // Besu uses 0 gas price
      nonce: nonce
    };
    
    // Sign and send (don't wait for receipt to speed up)
    const signedTx = await web3.eth.accounts.signTransaction(tx, OWNER_PRIVATE_KEY);
    const txHash = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    
    // Ensure txHash is a string
    const txHashStr = typeof txHash === 'string' ? txHash : (txHash.transactionHash || txHash.toString());
    const txHashShort = txHashStr.length > 10 ? txHashStr.substring(0, 10) + '...' : txHashStr;
    
    console.log(`✅ [${index + 1}/${NUM_ACCOUNTS}] Funded ${address} with ${FUND_AMOUNT_ETH} ETH (tx: ${txHashShort}, nonce: ${nonce})`);
    
    return {
      privateKey,
      address,
      funded: true,
      txHash: txHashStr
    };
  } catch (error) {
    console.error(`❌ [${index + 1}/${NUM_ACCOUNTS}] Failed to fund account: ${error.message}`);
    return null;
  }
}

// Main function
async function main() {
  console.log('='.repeat(80));
  console.log('💰 FUNDING BENCHMARK ACCOUNTS');
  console.log('='.repeat(80));
  console.log();
  console.log(`📋 Config:`);
  console.log(`   RPC: ${RPC_URL}`);
  console.log(`   Owner: ${ownerWallet.address}`);
  console.log(`   Number of accounts: ${NUM_ACCOUNTS}`);
  console.log(`   Fund amount: ${FUND_AMOUNT_ETH} ETH per account`);
  console.log();
  
  // Check owner balance
  const ownerBalance = await web3.eth.getBalance(ownerWallet.address);
  const totalNeeded = web3.utils.toWei((parseFloat(FUND_AMOUNT_ETH) * NUM_ACCOUNTS).toString(), 'ether');
  
  console.log(`💰 Owner balance: ${web3.utils.fromWei(ownerBalance, 'ether')} ETH`);
  console.log(`💰 Total needed: ${web3.utils.fromWei(totalNeeded, 'ether')} ETH`);
  console.log();
  
  if (ownerBalance < totalNeeded) {
    console.error(`❌ Insufficient balance! Need ${web3.utils.fromWei(totalNeeded, 'ether')} ETH but have ${web3.utils.fromWei(ownerBalance, 'ether')} ETH`);
    process.exit(1);
  }
  
  // Generate and fund accounts with optimized nonce management
  const accounts = [];
  let successCount = 0;
  let failCount = 0;
  
  console.log('🚀 Starting to fund accounts with optimized nonce management...');
  console.log();
  
  // Get initial nonce and wait for pending transactions
  let currentNonce = await web3.eth.getTransactionCount(ownerWallet.address, 'pending');
  const confirmedNonce = await web3.eth.getTransactionCount(ownerWallet.address, 'latest');
  
  console.log(`📌 Pending nonce: ${currentNonce}`);
  console.log(`📌 Confirmed nonce: ${confirmedNonce}`);
  
  // If there are pending transactions, wait for them to be mined
  if (currentNonce > confirmedNonce) {
    const pendingCount = currentNonce - confirmedNonce;
    console.log(`⏳ Waiting for ${pendingCount} pending transactions to be mined...`);
    
    let waitIterations = 0;
    while (currentNonce > confirmedNonce && waitIterations < 60) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const newConfirmed = await web3.eth.getTransactionCount(ownerWallet.address, 'latest');
      if (newConfirmed > confirmedNonce) {
        currentNonce = newConfirmed;
        console.log(`   ✅ Nonce updated: ${currentNonce} (${waitIterations + 1}s)`);
        break;
      }
      waitIterations++;
    }
    
    if (currentNonce > confirmedNonce) {
      console.log(`⚠️  Still ${currentNonce - confirmedNonce} pending transactions. Using confirmed nonce.`);
      currentNonce = confirmedNonce;
    }
  }
  
  console.log(`📌 Final starting nonce: ${currentNonce}`);
  console.log();
  
  // Batch size for parallel funding (reduce to avoid nonce congestion)
  const BATCH_SIZE = 3; // Reduced from 5 to avoid nonce issues
  const BATCH_DELAY = 500; // Increased delay between batches
  
  for (let i = 0; i < NUM_ACCOUNTS; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, NUM_ACCOUNTS);
    const batchPromises = [];
    
    // Create batch of funding transactions
    for (let j = i; j < batchEnd; j++) {
      const privateKey = generateRandomPrivateKey();
      const nonce = currentNonce + (j - i);
      batchPromises.push(fundAccount(privateKey, j, nonce));
    }
    
    // Execute batch in parallel
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Process results
    batchResults.forEach((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        accounts.push(result.value);
        successCount++;
      } else {
        failCount++;
      }
    });
    
    // Update nonce for next batch
    currentNonce += batchEnd - i;
    
    // Wait between batches to allow transactions to be mined
    if (i + BATCH_SIZE < NUM_ACCOUNTS) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
    
    // Progress update
    if ((i + BATCH_SIZE) % 20 === 0 || batchEnd === NUM_ACCOUNTS) {
      console.log(`📊 Progress: ${batchEnd}/${NUM_ACCOUNTS} (${successCount} success, ${failCount} failed, nonce: ${currentNonce})`);
    }
  }
  
  // Wait for all transactions to be mined
  console.log();
  console.log('⏳ Waiting for all transactions to be mined...');
  let pendingCount = NUM_ACCOUNTS;
  let lastPendingCount = pendingCount;
  let waitIterations = 0;
  
  while (pendingCount > 0 && waitIterations < 60) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const currentPending = await web3.eth.getTransactionCount(ownerWallet.address, 'pending');
    pendingCount = Math.max(0, currentPending - currentNonce);
    
    if (pendingCount !== lastPendingCount) {
      console.log(`   ⏳ Pending transactions: ${pendingCount}`);
      lastPendingCount = pendingCount;
    }
    waitIterations++;
  }
  
  if (pendingCount === 0) {
    console.log('✅ All transactions mined!');
  } else {
    console.log(`⚠️  ${pendingCount} transactions still pending after ${waitIterations} seconds`);
  }
  
  // Save funded accounts to file for Lacchain to use
  const { saveFundedAccounts } = require('./load-funded-accounts');
  // accounts array contains objects with {privateKey, address, funded, txHash}
  // Convert to Buffer array for saveFundedAccounts
  const fundedPrivateKeys = accounts
    .filter(acc => acc && acc.funded)
    .map(acc => {
      if (Buffer.isBuffer(acc.privateKey)) {
        return acc.privateKey;
      } else if (typeof acc.privateKey === 'string') {
        const keyStr = acc.privateKey.startsWith('0x') ? acc.privateKey.slice(2) : acc.privateKey;
        return Buffer.from(keyStr, 'hex');
      } else {
        return acc.privateKey; // Already a Buffer or compatible
      }
    });
  saveFundedAccounts(fundedPrivateKeys);
  
  console.log();
  console.log('='.repeat(80));
  console.log('✅ FUNDING COMPLETE');
  console.log('='.repeat(80));
  console.log();
  console.log(`✅ Successfully funded: ${successCount} accounts`);
  console.log(`❌ Failed: ${failCount} accounts`);
  console.log();
  console.log(`💡 Accounts saved to: server/funded-accounts.json`);
  console.log(`💡 Lacchain will use these pre-funded accounts`);
  console.log();
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

