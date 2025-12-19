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

// Fund account
async function fundAccount(privateKey, index) {
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
    
    // Get nonce
    const nonce = await web3.eth.getTransactionCount(ownerWallet.address, 'pending');
    
    // Create transaction
    const tx = {
      from: ownerWallet.address,
      to: address,
      value: fundAmountWei,
      gas: 21000,
      gasPrice: 0, // Besu uses 0 gas price
      nonce: nonce
    };
    
    // Sign and send
    const signedTx = await web3.eth.accounts.signTransaction(tx, OWNER_PRIVATE_KEY);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    
    console.log(`✅ [${index + 1}/${NUM_ACCOUNTS}] Funded ${address} with ${FUND_AMOUNT_ETH} ETH (tx: ${receipt.transactionHash.substring(0, 10)}...)`);
    
    return {
      privateKey,
      address,
      funded: true
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
  
  // Generate and fund accounts
  const accounts = [];
  let successCount = 0;
  let failCount = 0;
  
  console.log('🚀 Starting to fund accounts...');
  console.log();
  
  for (let i = 0; i < NUM_ACCOUNTS; i++) {
    const privateKey = generateRandomPrivateKey();
    const result = await fundAccount(privateKey, i);
    
    if (result) {
      accounts.push(result);
      successCount++;
    } else {
      failCount++;
    }
    
    // Small delay to avoid nonce issues
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Progress update every 10 accounts
    if ((i + 1) % 10 === 0) {
      console.log(`📊 Progress: ${i + 1}/${NUM_ACCOUNTS} (${successCount} success, ${failCount} failed)`);
    }
  }
  
  // Save funded accounts to file for Lacchain to use
  const { saveFundedAccounts } = require('./load-funded-accounts');
  const fundedPrivateKeys = accounts.map(acc => Buffer.from(acc.privateKey.replace('0x', ''), 'hex'));
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

