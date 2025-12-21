#!/usr/bin/env node

/**
 * Đăng ký tất cả funded accounts vào PKI Registry
 * Script này sẽ:
 * 1. Load funded accounts từ funded-accounts.json
 * 2. Đăng ký từng account vào PKI Registry (self-register)
 * 3. Verify KYC cho các accounts (nếu cần)
 * 4. Set authorization cho các accounts
 */

const Web3 = require('web3');
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = process.env.RPC_URL || 'https://localhost:21001';
const PKI_REGISTRY_ADDRESS = process.env.PKI_REGISTRY_ADDRESS || '0x43D1F9096674B5722D359B6402381816d5B22F28';
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY || '0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63';
const BANK_CODE = process.env.BANK_CODE || 'BENCHMARK';

// Disable TLS verification
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Initialize Web3
const web3 = new Web3(RPC_URL);
const ownerWallet = web3.eth.accounts.privateKeyToAccount(OWNER_PRIVATE_KEY);

// Load PKI Registry ABI
const pkiContractPath = path.join(__dirname, '../../Besu-hyperledger/smart_contracts/contracts/PKIRegistry.json');
if (!fs.existsSync(pkiContractPath)) {
    throw new Error(`PKI Registry JSON not found at: ${pkiContractPath}`);
}
const pkiContractJson = JSON.parse(fs.readFileSync(pkiContractPath, 'utf8'));
const pkiContractABI = pkiContractJson.abi;
const pkiContract = new web3.eth.Contract(pkiContractABI, PKI_REGISTRY_ADDRESS);

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

// Generate mock PQC public key (1952 bytes for Dilithium3)
function generateMockPublicKey() {
    // Dilithium3 public key is ~1952 bytes
    const keyBytes = Buffer.alloc(1952);
    // Fill with random data
    for (let i = 0; i < keyBytes.length; i++) {
        keyBytes[i] = Math.floor(Math.random() * 256);
    }
    return '0x' + keyBytes.toString('hex');
}

// Check if user is registered
async function isUserRegistered(address) {
    try {
        const userInfo = await pkiContract.methods.getUserInfo(address).call();
        return userInfo && userInfo.isActive;
    } catch (error) {
        return false;
    }
}

// Register user in PKI (self-register)
async function registerUser(address, privateKey, nonce) {
    try {
        // Check if already registered
        const isRegistered = await isUserRegistered(address);
        if (isRegistered) {
            console.log(`  ⏭️  ${address.substring(0, 10)}... already registered`);
            return { success: true, usedNonce: false };
        }
        
        // Generate mock public key
        const mockPublicKey = generateMockPublicKey();
        
        // Register user
        const tx = pkiContract.methods.registerUser(mockPublicKey);
        const gas = await tx.estimateGas({ from: address });
        const txData = tx.encodeABI();
        
        const signedTx = await web3.eth.accounts.signTransaction({
            from: address,
            to: PKI_REGISTRY_ADDRESS,
            data: txData,
            gas: gas,
            gasPrice: 0,
            nonce: nonce
        }, privateKey);
        
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        const txHashStr = typeof receipt === 'string' ? receipt : (receipt.transactionHash || receipt.toString());
        const txHashShort = txHashStr.length > 10 ? txHashStr.substring(0, 10) + '...' : txHashStr;
        console.log(`  ✅ Registered ${address.substring(0, 10)}... (tx: ${txHashShort}, nonce: ${nonce})`);
        return { success: true, usedNonce: true };
    } catch (error) {
        console.error(`  ❌ Failed to register ${address.substring(0, 10)}...: ${error.message}`);
        return { success: false, usedNonce: false };
    }
}

// Verify KYC for user (by owner/authorized bank)
async function verifyKYC(address, nonce) {
    try {
        // Check if already verified
        const kycInfo = await pkiContract.methods.kycRecords(address).call();
        if (kycInfo && kycInfo.isVerified) {
            console.log(`  ⏭️  ${address.substring(0, 10)}... KYC already verified`);
            return { success: true, usedNonce: false };
        }
        
        // Generate KYC hash
        const kycHash = web3.utils.keccak256(`KYC_BENCHMARK_${address}_${Date.now()}`);
        const expiryDays = 365;
        
        // Verify KYC
        const tx = pkiContract.methods.verifyKYC(address, kycHash, expiryDays);
        const gas = await tx.estimateGas({ from: ownerWallet.address });
        const txData = tx.encodeABI();
        
        const signedTx = await web3.eth.accounts.signTransaction({
            from: ownerWallet.address,
            to: PKI_REGISTRY_ADDRESS,
            data: txData,
            gas: gas,
            gasPrice: 0,
            nonce: nonce
        }, OWNER_PRIVATE_KEY);
        
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        const txHashStr = typeof receipt === 'string' ? receipt : (receipt.transactionHash || receipt.toString());
        const txHashShort = txHashStr.length > 10 ? txHashStr.substring(0, 10) + '...' : txHashStr;
        console.log(`  ✅ KYC verified for ${address.substring(0, 10)}... (tx: ${txHashShort}, nonce: ${nonce})`);
        return { success: true, usedNonce: true };
    } catch (error) {
        console.error(`  ❌ Failed to verify KYC for ${address.substring(0, 10)}...: ${error.message}`);
        return { success: false, usedNonce: false };
    }
}

// Set authorization for user
async function setAuthorization(address, nonce) {
    try {
        // Check if already authorized
        const auth = await pkiContract.methods.authorizations(address).call();
        if (auth && auth.canTransfer && auth.canReceive) {
            console.log(`  ⏭️  ${address.substring(0, 10)}... already authorized`);
            return { success: true, usedNonce: false };
        }
        
        // Set authorization (100 ETH daily limit)
        const dailyLimit = web3.utils.toWei('100', 'ether');
        const tx = pkiContract.methods.setAuthorization(
            address,
            true,  // canTransfer
            true,  // canReceive
            dailyLimit
        );
        const gas = await tx.estimateGas({ from: ownerWallet.address });
        const txData = tx.encodeABI();
        
        const signedTx = await web3.eth.accounts.signTransaction({
            from: ownerWallet.address,
            to: PKI_REGISTRY_ADDRESS,
            data: txData,
            gas: gas,
            gasPrice: 0,
            nonce: nonce
        }, OWNER_PRIVATE_KEY);
        
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        const txHashStr = typeof receipt === 'string' ? receipt : (receipt.transactionHash || receipt.toString());
        const txHashShort = txHashStr.length > 10 ? txHashStr.substring(0, 10) + '...' : txHashStr;
        console.log(`  ✅ Authorization set for ${address.substring(0, 10)}... (tx: ${txHashShort}, nonce: ${nonce})`);
        return { success: true, usedNonce: true };
    } catch (error) {
        console.error(`  ❌ Failed to set authorization for ${address.substring(0, 10)}...: ${error.message}`);
        return { success: false, usedNonce: false };
    }
}

// Main function
async function main() {
    console.log('='.repeat(80));
    console.log('🔐 REGISTERING FUNDED ACCOUNTS IN PKI REGISTRY');
    console.log('='.repeat(80));
    console.log();
    console.log('📋 Config:');
    console.log(`   RPC: ${RPC_URL}`);
    console.log(`   PKI Registry: ${PKI_REGISTRY_ADDRESS}`);
    console.log(`   Owner: ${ownerWallet.address}`);
    console.log();
    
    // Check owner balance
    const ownerBalance = await web3.eth.getBalance(ownerWallet.address);
    console.log(`💰 Owner balance: ${web3.utils.fromWei(ownerBalance, 'ether')} ETH`);
    console.log();
    
    // Load accounts
    const accounts = loadFundedAccounts();
    console.log(`📋 Loaded ${accounts.length} funded accounts`);
    console.log();
    
    // Get initial nonce for owner
    let ownerNonce = await web3.eth.getTransactionCount(ownerWallet.address, 'pending');
    console.log(`📌 Owner starting nonce: ${ownerNonce}`);
    console.log();
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    // Process accounts sequentially
    for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        const address = account.address;
        const privateKey = account.privateKey;
        
        console.log(`[${i + 1}/${accounts.length}] Processing ${address.substring(0, 10)}...`);
        
        try {
            // Step 1: Register user (self-register)
            const userNonce = await web3.eth.getTransactionCount(address, 'pending');
            const registerResult = await registerUser(address, privateKey, userNonce);
            
            if (!registerResult.success) {
                failCount++;
                continue;
            }
            
            // Wait a bit for transaction to be mined
            if (registerResult.usedNonce) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Step 2: Verify KYC (by owner)
            const kycResult = await verifyKYC(address, ownerNonce);
            if (kycResult.usedNonce) {
                ownerNonce++;
            }
            
            // Wait a bit
            if (kycResult.usedNonce) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Step 3: Set authorization (by owner)
            const authResult = await setAuthorization(address, ownerNonce);
            if (authResult.usedNonce) {
                ownerNonce++;
            }
            
            if (registerResult.success && kycResult.success && authResult.success) {
                successCount++;
            } else {
                skipCount++;
            }
            
        } catch (error) {
            console.error(`  ❌ Error: ${error.message}`);
            failCount++;
        }
        
        // Progress update
        if ((i + 1) % 20 === 0 || i === accounts.length - 1) {
            console.log(`📊 Progress: ${i + 1}/${accounts.length} (${successCount} success, ${skipCount} skipped, ${failCount} failed, owner nonce: ${ownerNonce})`);
        }
        
        // Small delay to avoid overwhelming the network
        if (i < accounts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    console.log();
    console.log('='.repeat(80));
    console.log('✅ REGISTRATION COMPLETE');
    console.log('='.repeat(80));
    console.log();
    console.log(`✅ Successfully registered: ${successCount} accounts`);
    console.log(`⏭️  Skipped: ${skipCount} accounts`);
    console.log(`❌ Failed: ${failCount} accounts`);
    console.log();
    console.log('💡 Accounts are now registered in PKI and can perform transfers');
}

main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});

