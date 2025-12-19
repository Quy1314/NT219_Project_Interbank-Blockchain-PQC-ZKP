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
        const data = accounts.map(acc => ({
            privateKey: '0x' + acc.toString('hex'),
            address: require('./pantheon_utils/web3').web3.eth.accounts.privateKeyToAccount('0x' + acc.toString('hex')).address
        }));
        fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2));
        console.log(`✅ Saved ${accounts.length} accounts to ${ACCOUNTS_FILE}`);
    } catch (error) {
        console.error('❌ Error saving funded accounts:', error.message);
    }
}

module.exports = { loadFundedAccounts, saveFundedAccounts };

