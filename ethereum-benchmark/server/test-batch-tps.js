#!/usr/bin/env node

/**
 * Script to test batch transactions for different TPS targets (20, 40, 50)
 * Uses batchTransfer() to send multiple transfers in one transaction
 */

const Web3 = require('web3');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Config
const RPC_URL = process.env.RPC_ENDPOINT || 'https://localhost:21001';
const TARGET_TPS = parseInt(process.env.TARGET_TPS || '20'); // 20, 40, or 50
const TEST_DURATION_SECONDS = parseInt(process.env.TEST_DURATION || '60'); // 60 seconds = 1 minute
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '50'); // Transfers per batch

// Disable SSL verification
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

// Load contract ABI - try multiple paths
let contractABI;
const possiblePaths = [
  path.join(__dirname, '../../Besu-hyperledger/smart_contracts/contracts/InterbankTransfer.json'),
  path.join(__dirname, 'smartContract/build/InterbankTransfer/InterbankTransfer.json'),
  path.join(__dirname, '../../Besu-hyperledger/smart_contracts/contracts/InterbankTransfer.json')
];

for (const abiPath of possiblePaths) {
  if (fs.existsSync(abiPath)) {
    try {
      const contractJson = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
      contractABI = contractJson.abi;
      console.log(`✅ Loaded ABI from: ${abiPath}`);
      break;
    } catch (error) {
      console.log(`⚠️  Failed to load ABI from ${abiPath}: ${error.message}`);
    }
  }
}

if (!contractABI) {
  throw new Error('Could not load contract ABI from any of the expected paths');
}

// Load contract address
const contractAddressFile = path.join(__dirname, '../../Besu-hyperledger/smart_contracts/contracts/InterbankTransfer.address.txt');
let contractAddress;
if (fs.existsSync(contractAddressFile)) {
  contractAddress = fs.readFileSync(contractAddressFile, 'utf8').trim();
} else {
  contractAddress = process.env.INTERBANK_CONTRACT_ADDRESS || '0x42699A7612A82f1d9C36148af9C77354759b210b';
}

// Load funded accounts
const fundedAccountsFile = path.join(__dirname, 'funded-accounts.json');
let fundedAccounts = [];
if (fs.existsSync(fundedAccountsFile)) {
  const accountsData = JSON.parse(fs.readFileSync(fundedAccountsFile, 'utf8'));
  fundedAccounts = accountsData.map(acc => {
    // Handle different formats
    if (typeof acc === 'string') {
      // Direct string (hex with or without 0x)
      return acc.startsWith('0x') ? acc : '0x' + acc;
    } else if (Buffer.isBuffer(acc)) {
      // Buffer object
      return '0x' + acc.toString('hex');
    } else if (acc && acc.privateKey) {
      // Object with privateKey property
      const pk = acc.privateKey;
      if (typeof pk === 'string') {
        return pk.startsWith('0x') ? pk : '0x' + pk;
      } else if (Buffer.isBuffer(pk)) {
        return '0x' + pk.toString('hex');
      } else {
        return '0x' + pk.toString('hex');
      }
    } else {
      // Try to convert to string
      const pkStr = acc.toString ? acc.toString('hex') : String(acc);
      return pkStr.startsWith('0x') ? pkStr : '0x' + pkStr;
    }
  });
}

// Create contract instance
const contract = new web3.eth.Contract(contractABI, contractAddress);

// Generate random recipient address
function getRandomRecipient() {
  const randomIndex = Math.floor(Math.random() * fundedAccounts.length);
  return web3.eth.accounts.privateKeyToAccount(fundedAccounts[randomIndex]).address;
}

// Create batch transfer
async function createBatchTransfer(fromPrivateKey, batchSize, senderAddress) {
  const recipients = [];
  const amounts = [];
  const toBankCodes = [];
  const descriptions = [];
  
  const amountWei = web3.utils.toWei('0.001', 'ether'); // 0.001 ETH per transfer
  
  for (let i = 0; i < batchSize; i++) {
    recipients.push(getRandomRecipient(senderAddress));
    amounts.push(amountWei);
    toBankCodes.push('VCB');
    descriptions.push(`Batch transfer ${i + 1} at ${Date.now()}`);
  }
  
  return { recipients, amounts, toBankCodes, descriptions };
}

// Check balance in contract
async function checkContractBalance(address) {
  try {
    const balance = await contract.methods.getBalance(address).call();
    return web3.utils.toBN(balance);
  } catch (error) {
    return web3.utils.toBN(0);
  }
}

// Send batch transaction
async function sendBatchTransaction(fromPrivateKey, batchSize) {
  try {
    const account = web3.eth.accounts.privateKeyToAccount(fromPrivateKey);
    const fromAddress = account.address;
    
    // Check balance in contract
    const balance = await checkContractBalance(fromAddress);
    const amountWei = web3.utils.toWei('0.001', 'ether');
    const totalAmount = web3.utils.toBN(amountWei).mul(web3.utils.toBN(batchSize));
    
    if (balance.lt(totalAmount)) {
      return {
        success: false,
        error: `Insufficient contract balance: have ${web3.utils.fromWei(balance, 'ether')} ETH, need ${web3.utils.fromWei(totalAmount, 'ether')} ETH`,
        transfers: batchSize
      };
    }
    
    // Check if PKI is enabled (optional check)
    try {
      const pkiEnabled = await contract.methods.pkiEnabled().call();
      if (pkiEnabled) {
        // Check if account is registered in PKI
        try {
          const pkiRegistryAddress = await contract.methods.pkiRegistry().call();
          if (pkiRegistryAddress && pkiRegistryAddress !== '0x0000000000000000000000000000000000000000') {
            // Try to check KYC status (if PKI registry ABI available)
            // This is optional - if it fails, we'll try the transaction anyway
          }
        } catch (e) {
          // PKI check failed, continue anyway
        }
      }
    } catch (e) {
      // PKI check failed, continue anyway
    }
    
    // Get nonce
    const nonce = await web3.eth.getTransactionCount(fromAddress, 'pending');
    
    // Create batch data
    const { recipients, amounts, toBankCodes, descriptions } = await createBatchTransfer(fromPrivateKey, batchSize, fromAddress);
    
    // Try to call first to check for revert reason
    try {
      await contract.methods.batchTransfer(
        recipients,
        amounts,
        toBankCodes,
        descriptions
      ).call({ from: fromAddress });
    } catch (callError) {
      // Extract revert reason
      let errorMsg = callError.message || callError.reason || 'Transaction will revert';
      
      // Try to extract more details
      if (callError.data) {
        if (typeof callError.data === 'string') {
          errorMsg = callError.data;
        } else if (callError.data.message) {
          errorMsg = callError.data.message;
        } else if (callError.data.reason) {
          errorMsg = callError.data.reason;
        }
      }
      
      // Check common errors
      if (errorMsg.includes('User not registered') || errorMsg.includes('KYC not valid')) {
        errorMsg = 'PKI enabled but account not registered. Run: node register-pki-accounts.js';
      } else if (errorMsg.includes('Insufficient balance')) {
        errorMsg = 'Insufficient contract balance. Run: node deposit-contract-balances.js';
      } else if (errorMsg.includes('Not authorized')) {
        errorMsg = 'Account not authorized. Run: node deposit-contract-balances.js';
      }
      
      return {
        success: false,
        error: errorMsg,
        transfers: batchSize
      };
    }
    
    // Encode batchTransfer function
    const txData = contract.methods.batchTransfer(
      recipients,
      amounts,
      toBankCodes,
      descriptions
    ).encodeABI();
    
    // Build transaction
    const tx = {
      from: fromAddress,
      to: contractAddress,
      data: txData,
      gas: 16000000, // High gas limit for batch
      gasPrice: 0,
      nonce: nonce
    };
    
    // Sign and send
    const signedTx = await web3.eth.accounts.signTransaction(tx, fromPrivateKey);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    
    if (!receipt.status) {
      return {
        success: false,
        error: 'Transaction reverted (check contract balance and authorization)',
        transfers: batchSize
      };
    }
    
    return {
      success: true,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      transfers: batchSize
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      transfers: batchSize
    };
  }
}

// Calculate required batch rate
function calculateBatchRate(targetTPS, batchSize) {
  // If batch size is 50, and we want 50 TPS
  // We need: 50 TPS / 50 transfers per batch = 1 batch per second
  return targetTPS / batchSize;
}

// Main test function
async function runTest() {
  console.log('='.repeat(80));
  console.log(`🚀 BATCH TRANSACTION BENCHMARK TEST`);
  console.log('='.repeat(80));
  console.log();
  console.log(`📋 Configuration:`);
  console.log(`   Target TPS: ${TARGET_TPS}`);
  console.log(`   Batch Size: ${BATCH_SIZE} transfers per batch`);
  console.log(`   Test Duration: ${TEST_DURATION_SECONDS} seconds`);
  console.log(`   Contract Address: ${contractAddress}`);
  console.log(`   Funded Accounts: ${fundedAccounts.length}`);
  console.log();
  
  if (fundedAccounts.length === 0) {
    console.error('❌ No funded accounts found!');
    console.error('   Please run: ./fund-accounts.sh 200 10');
    process.exit(1);
  }
  
  // Calculate batch rate
  const batchRate = calculateBatchRate(TARGET_TPS, BATCH_SIZE);
  const intervalMs = Math.floor(1000 / batchRate); // Milliseconds between batches
  
  console.log(`📊 Batch Rate Calculation:`);
  console.log(`   Target: ${TARGET_TPS} TPS`);
  console.log(`   Batch Size: ${BATCH_SIZE} transfers`);
  console.log(`   Required: ${batchRate.toFixed(2)} batches/second`);
  console.log(`   Interval: ${intervalMs}ms between batches`);
  console.log();
  
  // Test results
  const results = {
    startTime: Date.now(),
    endTime: null,
    batchesSent: 0,
    batchesSuccess: 0,
    batchesFailed: 0,
    totalTransfers: 0,
    successfulTransfers: 0,
    failedTransfers: 0,
    transactions: []
  };
  
  console.log('🚀 Starting benchmark...');
  console.log();
  
  const startTime = Date.now();
  const endTime = startTime + (TEST_DURATION_SECONDS * 1000);
  
  // Use different accounts for each batch to avoid nonce conflicts
  let accountIndex = 0;
  
  // Send batches at calculated rate
  while (Date.now() < endTime) {
    const batchStartTime = Date.now();
    
    // Get next account
    const fromPrivateKey = fundedAccounts[accountIndex % fundedAccounts.length];
    accountIndex++;
    
    // Send batch
    const result = await sendBatchTransaction(fromPrivateKey, BATCH_SIZE);
    
    const batchEndTime = Date.now();
    const latency = batchEndTime - batchStartTime;
    
    results.batchesSent++;
    results.totalTransfers += BATCH_SIZE;
    
    if (result.success) {
      results.batchesSuccess++;
      results.successfulTransfers += BATCH_SIZE;
      console.log(`✅ Batch ${results.batchesSent}: ${BATCH_SIZE} transfers in ${latency}ms (tx: ${result.txHash.substring(0, 10)}...)`);
    } else {
      results.batchesFailed++;
      results.failedTransfers += BATCH_SIZE;
      console.log(`❌ Batch ${results.batchesSent}: Failed - ${result.error}`);
    }
    
    results.transactions.push({
      batchNumber: results.batchesSent,
      success: result.success,
      txHash: result.txHash,
      latency,
      transfers: BATCH_SIZE
    });
    
    // Wait for next batch interval
    const elapsed = Date.now() - batchStartTime;
    const waitTime = Math.max(0, intervalMs - elapsed);
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  results.endTime = Date.now();
  const totalTime = (results.endTime - results.startTime) / 1000; // seconds
  
  // Calculate metrics
  const actualTPS = results.successfulTransfers / totalTime;
  const successRate = (results.successfulTransfers / results.totalTransfers) * 100;
  const avgLatency = results.transactions
    .filter(tx => tx.success)
    .reduce((sum, tx) => sum + tx.latency, 0) / results.batchesSuccess || 0;
  
  // Print results
  console.log();
  console.log('='.repeat(80));
  console.log('📊 BENCHMARK RESULTS');
  console.log('='.repeat(80));
  console.log();
  console.log(`Target TPS: ${TARGET_TPS}`);
  console.log(`Actual TPS: ${actualTPS.toFixed(2)}`);
  console.log(`Success Rate: ${successRate.toFixed(2)}%`);
  console.log(`Total Batches: ${results.batchesSent}`);
  console.log(`Successful Batches: ${results.batchesSuccess}`);
  console.log(`Failed Batches: ${results.batchesFailed}`);
  console.log(`Total Transfers: ${results.totalTransfers}`);
  console.log(`Successful Transfers: ${results.successfulTransfers}`);
  console.log(`Failed Transfers: ${results.failedTransfers}`);
  console.log(`Average Latency: ${avgLatency.toFixed(2)}ms per batch`);
  console.log(`Test Duration: ${totalTime.toFixed(2)} seconds`);
  console.log();
  
  // Save results to file
  const resultsFile = path.join(__dirname, 'logs', `batch-${TARGET_TPS}-tps-results.json`);
  fs.mkdirSync(path.dirname(resultsFile), { recursive: true });
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`💾 Results saved to: ${resultsFile}`);
  console.log();
  
  // Summary
  if (actualTPS >= TARGET_TPS * 0.9) {
    console.log('✅ SUCCESS: Achieved target TPS!');
  } else {
    console.log('⚠️  WARNING: Did not achieve target TPS');
  }
}

// Run test
runTest().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

