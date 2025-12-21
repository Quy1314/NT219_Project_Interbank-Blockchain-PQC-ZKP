#!/usr/bin/env node

/**
 * Load pre-funded accounts from a file
 * This allows Lacchain to use accounts that have been funded
 */

const fs = require('fs');
const path = require('path');

const ACCOUNTS_FILE = path.join(__dirname, 'funded-accounts.json');

function loadFundedAccounts() {
    if (fs.existsSync(ACCOUNTS_FILE)) {
        try {
            const data = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
            const accounts = JSON.parse(data);
            console.log(`✅ Loaded ${accounts.length} pre-funded accounts from file`);
            return accounts.map(acc => Buffer.from(acc.privateKey.replace('0x', ''), 'hex'));
        } catch (error) {
            console.error('❌ Error loading funded accounts:', error.message);
            return null;
        }
    }
    return null;
}

function saveFundedAccounts(accounts) {
    try {
        // accounts can be either Buffer objects or objects with privateKey/address
        const data = accounts.map(acc => {
            if (Buffer.isBuffer(acc)) {
                // If it's a Buffer, convert to hex string
                const privateKeyHex = '0x' + acc.toString('hex');
                // Use Web3 to get address from private key
                const Web3 = require('web3');
                const web3 = new Web3();
                const account = web3.eth.accounts.privateKeyToAccount(privateKeyHex);
                return {
                    privateKey: privateKeyHex,
                    address: account.address
                };
            } else if (acc && acc.privateKey) {
                // If it's already an object with privateKey
                return {
                    privateKey: typeof acc.privateKey === 'string' ? acc.privateKey : ('0x' + acc.privateKey.toString('hex')),
                    address: acc.address || ''
                };
            } else {
                // Fallback: try to convert to string
                const privateKeyHex = '0x' + (acc.toString ? acc.toString('hex') : String(acc));
                const Web3 = require('web3');
                const web3 = new Web3();
                const account = web3.eth.accounts.privateKeyToAccount(privateKeyHex);
                return {
                    privateKey: privateKeyHex,
                    address: account.address
                };
            }
        });
        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2));
        console.log(`✅ Saved ${accounts.length} accounts to ${ACCOUNTS_FILE}`);
    } catch (error) {
        console.error('❌ Error saving funded accounts:', error.message);
        console.error('Stack:', error.stack);
    }
}

module.exports = { loadFundedAccounts, saveFundedAccounts };

