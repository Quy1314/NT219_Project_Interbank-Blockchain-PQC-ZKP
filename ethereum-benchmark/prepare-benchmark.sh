#!/bin/bash

# Script to prepare benchmark: fund accounts and check setup
# Usage: ./prepare-benchmark.sh [num_accounts] [fund_amount_eth]

set -e

NUM_ACCOUNTS=${1:-100}
FUND_AMOUNT_ETH=${2:-10}

echo "=========================================="
echo "🔧 PREPARING BENCHMARK"
echo "=========================================="
echo ""
echo "📋 Config:"
echo "   Number of accounts: $NUM_ACCOUNTS"
echo "   Fund amount: $FUND_AMOUNT_ETH ETH per account"
echo ""

# Check if blockchain is running
echo "🔍 Checking blockchain..."
if ! curl -k -s https://localhost:21001 > /dev/null 2>&1; then
    echo "❌ Blockchain is not running!"
    echo "   Please start blockchain first: cd Besu-hyperledger && ./run.sh"
    exit 1
fi
echo "✅ Blockchain is running"
echo ""

# Check contract address
CONTRACT_ADDRESS_FILE="../Besu-hyperledger/smart_contracts/contracts/InterbankTransfer.address.txt"
if [ -f "$CONTRACT_ADDRESS_FILE" ]; then
    CONTRACT_ADDRESS=$(cat "$CONTRACT_ADDRESS_FILE" | tr -d '\n')
    echo "✅ Contract address: $CONTRACT_ADDRESS"
else
    echo "❌ Contract address not found!"
    echo "   Please deploy contract first"
    exit 1
fi
echo ""

# Fund accounts
echo "💰 Funding $NUM_ACCOUNTS accounts..."
cd server

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 \
PRIVATE_KEY=0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63 \
NUM_ACCOUNTS=$NUM_ACCOUNTS \
FUND_AMOUNT_ETH=$FUND_AMOUNT_ETH \
node fund-benchmark-accounts.js
cd ..

echo ""
echo "✅ Preparation complete!"
echo ""
echo "🚀 Ready to run benchmark:"
echo "   ./RUN_BENCHMARK.sh 10 2"
echo ""

