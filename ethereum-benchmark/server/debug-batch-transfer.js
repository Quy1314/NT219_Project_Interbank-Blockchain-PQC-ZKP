#!/usr/bin/env node

/**
 * Debug script to test batchTransfer function
 */

const Web3 = require('web3');
const https = require('https');
const fs = require('fs');
const path = require('path');

// Config
const RPC_URL = process.env.RPC_ENDPOINT || 'https://localhost:21001';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Setup Web3
const provider = new Web3.providers.HttpProvider(RPC_URL, { 
  agent: new https.Agent({ rejectUnauthorized: false }) 
});
const web3 = new Web3(provider);

// Load contract
const contractABI = require('../../Besu-hyperledger/smart_contracts/contracts/InterbankTransfer.json').abi;
const contractAddress = '0x42699A7612A82f1d9C36148af9C77354759b210b';
const contract = new web3.eth.Contract(contractABI, contractAddress);

// Load first funded account
const accounts = JSON.parse(fs.readFileSync('funded-accounts.json', 'utf8'));
const firstAccount = accounts[0];
const privateKey = firstAccount.privateKey;
const account = web3.eth.accounts.privateKeyToAccount(privateKey);
const address = account.address;

async function test() {
  console.log('Testing batchTransfer...');
  console.log('Account:', address);
  
  // Check balance
  const balance = await contract.methods.getBalance(address).call();
  console.log('Contract Balance:', web3.utils.fromWei(balance, 'ether'), 'ETH');
  
  // Check PKI status
  const pkiEnabled = await contract.methods.pkiEnabled().call();
  console.log('PKI Enabled:', pkiEnabled);
  
  // Test batchTransfer with small batch - use different recipient
  const secondAccount = accounts[1];
  const recipientAddress = web3.eth.accounts.privateKeyToAccount(secondAccount.privateKey).address;
  
  const recipients = [recipientAddress]; // Transfer to different account
  const amounts = [web3.utils.toWei('0.001', 'ether')];
  const toBankCodes = ['VCB'];
  const descriptions = ['Test batch transfer'];
  
  try {
    console.log('\nTrying to call batchTransfer...');
    const result = await contract.methods.batchTransfer(
      recipients,
      amounts,
      toBankCodes,
      descriptions
    ).call({ from: address });
    console.log('✅ Call successful:', result);
  } catch (error) {
    console.log('\n❌ Call failed:');
    console.log('Message:', error.message);
    console.log('Reason:', error.reason);
    console.log('Data:', JSON.stringify(error.data, null, 2));
    
    // Try to decode error
    if (error.data) {
      if (typeof error.data === 'string' && error.data.startsWith('0x')) {
        // Try to decode revert reason
        const revertReason = error.data.substring(138); // Skip function selector
        if (revertReason && revertReason !== '0x') {
          try {
            const decoded = web3.eth.abi.decodeParameter('string', '0x' + revertReason.substring(2));
            console.log('Decoded revert reason:', decoded);
          } catch (e) {
            console.log('Could not decode revert reason');
          }
        }
      }
    }
  }
}

test().catch(console.error);

