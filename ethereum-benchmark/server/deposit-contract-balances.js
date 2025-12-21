#!/usr/bin/env node

/**
 * Deposit balance vào InterbankTransfer contract cho các funded accounts
 * Script này sẽ:
 * 1. Load funded accounts từ funded-accounts.json
 * 2. Authorize các accounts (nếu chưa authorized)
 * 3. Deposit balance vào contract cho mỗi account
 */

const Web3 = require('web3');
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = process.env.RPC_URL || 'https://localhost:21001';
const CONTRACT_ADDRESS = process.env.INTERBANK_CONTRACT_ADDRESS || '0x42699A7612A82f1d9C36148af9C77354759b210b';
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY || '0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63';
const DEPOSIT_AMOUNT_ETH = process.env.DEPOSIT_AMOUNT_ETH || '10'; // Amount to deposit per account
const BANK_CODE = process.env.BANK_CODE || 'BENCHMARK';

// Disable TLS verification
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Initialize Web3
const web3 = new Web3(RPC_URL);
const ownerWallet = web3.eth.accounts.privateKeyToAccount(OWNER_PRIVATE_KEY);

// Load contract ABI
const contractJsonPath = path.join(__dirname, 'smartContract/build/InterbankTransfer/InterbankTransfer.json');
if (!fs.existsSync(contractJsonPath)) {
    throw new Error(`Contract JSON not found at: ${contractJsonPath}`);
}
const contractJson = JSON.parse(fs.readFileSync(contractJsonPath, 'utf8'));
const contractABI = contractJson.abi;
const contract = new web3.eth.Contract(contractABI, CONTRACT_ADDRESS);

// Load funded accounts
function loadFundedAccounts() {
    const accountsFile = path.join(__dirname, 'funded-accounts.json');
    if (!fs.existsSync(accountsFile)) {
        console.error('❌ funded-accounts.json not found. Run prepare-benchmark.sh first!');
        process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
    return data;
}

// Authorize account with nonce management
async function authorizeAccount(address, bankCode, nonce) {
    try {
        const isAuthorized = await contract.methods.authorizedBanks(address).call();
        if (isAuthorized) {
            return true; // Already authorized
        }
        
        const tx = contract.methods.addAuthorizedBank(address, bankCode);
        const gas = await tx.estimateGas({ from: ownerWallet.address });
        const txData = tx.encodeABI();
        
        const signedTx = await web3.eth.accounts.signTransaction({
            from: ownerWallet.address,
            to: CONTRACT_ADDRESS,
            data: txData,
            gas: gas,
            gasPrice: 0,
            nonce: nonce
        }, OWNER_PRIVATE_KEY);
        
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        console.log(`  ✅ Authorized ${address.substring(0, 10)}... (tx: ${receipt.transactionHash.substring(0, 10)}..., nonce: ${nonce})`);
        return true;
    } catch (error) {
        console.error(`  ❌ Failed to authorize ${address.substring(0, 10)}...: ${error.message}`);
        return false;
    }
}

// Deposit balance for account with nonce management
async function depositForAccount(address, bankCode, amountWei, nonce) {
    try {
        // Check current balance
        const currentBalance = await contract.methods.getBalance(address).call();
        if (parseInt(currentBalance) >= parseInt(amountWei)) {
            console.log(`  ⏭️  ${address.substring(0, 10)}... already has balance: ${web3.utils.fromWei(currentBalance, 'ether')} ETH`);
            return { success: true, usedNonce: false };
        }
        
        // Check if authorized
        const isAuthorized = await contract.methods.authorizedBanks(address).call();
        let currentNonce = nonce;
        
        if (!isAuthorized) {
            // Authorize first
            const authResult = await authorizeAccount(address, bankCode, currentNonce);
            if (!authResult) {
                return { success: false, usedNonce: false };
            }
            currentNonce++; // Increment for deposit
        }
        
        // Deposit
        const tx = contract.methods.deposit(address, bankCode);
        const gas = await tx.estimateGas({ 
            from: ownerWallet.address,
            value: amountWei
        });
        const txData = tx.encodeABI();
        
        const signedTx = await web3.eth.accounts.signTransaction({
            from: ownerWallet.address,
            to: CONTRACT_ADDRESS,
            data: txData,
            value: amountWei,
            gas: gas,
            gasPrice: 0,
            nonce: currentNonce
        }, OWNER_PRIVATE_KEY);
        
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        const txHashStr = typeof receipt === 'string' ? receipt : (receipt.transactionHash || receipt.toString());
        const txHashShort = txHashStr.length > 10 ? txHashStr.substring(0, 10) + '...' : txHashStr;
        console.log(`  ✅ Deposited ${web3.utils.fromWei(amountWei, 'ether')} ETH to ${address.substring(0, 10)}... (tx: ${txHashShort}, nonce: ${currentNonce})`);
        return { success: true, usedNonce: !isAuthorized ? 2 : 1 }; // 2 if authorized + deposited, 1 if just deposited
    } catch (error) {
        console.error(`  ❌ Failed to deposit for ${address.substring(0, 10)}...: ${error.message}`);
        return { success: false, usedNonce: false };
    }
}

// Main function
async function main() {
    console.log('='.repeat(80));
    console.log('💰 DEPOSITING CONTRACT BALANCES FOR FUNDED ACCOUNTS');
    console.log('='.repeat(80));
    console.log();
    console.log('📋 Config:');
    console.log(`   RPC: ${RPC_URL}`);
    console.log(`   Contract: ${CONTRACT_ADDRESS}`);
    console.log(`   Owner: ${ownerWallet.address}`);
    console.log(`   Deposit amount: ${DEPOSIT_AMOUNT_ETH} ETH per account`);
    console.log(`   Bank code: ${BANK_CODE}`);
    console.log();
    
    // Check owner balance
    const ownerBalance = await web3.eth.getBalance(ownerWallet.address);
    const depositAmountWei = web3.utils.toWei(DEPOSIT_AMOUNT_ETH, 'ether');
    console.log(`💰 Owner balance: ${web3.utils.fromWei(ownerBalance, 'ether')} ETH`);
    
    // Load accounts
    const accounts = loadFundedAccounts();
    console.log(`📋 Loaded ${accounts.length} funded accounts`);
    console.log();
    
    const totalNeeded = BigInt(depositAmountWei) * BigInt(accounts.length);
    if (BigInt(ownerBalance) < totalNeeded) {
        console.warn(`⚠️  Owner balance may not be enough for all deposits`);
        console.warn(`   Needed: ${web3.utils.fromWei(totalNeeded.toString(), 'ether')} ETH`);
    }
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
    
    // Process accounts sequentially to avoid nonce conflicts
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;
    
    for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        const address = account.address;
        
        // Check if already has balance
        try {
            const currentBalance = await contract.methods.getBalance(address).call();
            if (parseInt(currentBalance) >= parseInt(depositAmountWei)) {
                skipCount++;
                if ((i + 1) % 20 === 0) {
                    console.log(`📊 Progress: ${i + 1}/${accounts.length} (${successCount} success, ${skipCount} skipped, ${failCount} failed, nonce: ${currentNonce})`);
                }
                continue;
            }
        } catch (error) {
            // Continue if check fails
        }
        
        // Check if authorized (may need 1 or 2 transactions)
        const isAuthorized = await contract.methods.authorizedBanks(address).call();
        let nonceForThisAccount = currentNonce;
        
        if (!isAuthorized) {
            // Need to authorize first, then deposit
            const authResult = await authorizeAccount(address, BANK_CODE, nonceForThisAccount);
            if (authResult) {
                currentNonce++;
                nonceForThisAccount = currentNonce;
            } else {
                failCount++;
                currentNonce++; // Still increment to avoid nonce conflicts
                continue;
            }
        }
        
        // Deposit
        const depositResult = await depositForAccount(address, BANK_CODE, depositAmountWei, nonceForThisAccount);
        if (depositResult.success) {
            successCount++;
            currentNonce += depositResult.usedNonce || 1;
        } else {
            failCount++;
            currentNonce++; // Still increment
        }
        
        // Progress update
        if ((i + 1) % 20 === 0 || i === accounts.length - 1) {
            console.log(`📊 Progress: ${i + 1}/${accounts.length} (${successCount} success, ${skipCount} skipped, ${failCount} failed, nonce: ${currentNonce})`);
        }
        
        // Small delay to avoid overwhelming the network
        if (i < accounts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    console.log();
    console.log('='.repeat(80));
    console.log('✅ DEPOSIT COMPLETE');
    console.log('='.repeat(80));
    console.log();
    console.log(`✅ Successfully deposited: ${successCount} accounts`);
    console.log(`⏭️  Skipped (already had balance): ${skipCount} accounts`);
    console.log(`❌ Failed: ${failCount} accounts`);
    console.log();
    console.log('💡 Accounts now have balance in contract and can perform transfers');
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

