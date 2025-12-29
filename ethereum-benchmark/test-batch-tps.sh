#!/bin/bash

# Script to test batch transactions for different TPS targets
# Usage: ./test-batch-tps.sh [20|40|50] [duration_seconds]

set -e

TARGET_TPS=${1:-20}
DURATION=${2:-60}

# Validate TPS target
if [[ ! "$TARGET_TPS" =~ ^(20|40|50)$ ]]; then
    echo "❌ Invalid TPS target: $TARGET_TPS"
    echo "   Valid targets: 20, 40, 50"
    exit 1
fi

echo "=========================================="
echo "🚀 BATCH TRANSACTION BENCHMARK"
echo "=========================================="
echo ""
echo "📋 Configuration:"
echo "   Target TPS: $TARGET_TPS"
echo "   Duration: $DURATION seconds"
echo "   Batch Size: 50 transfers per batch"
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

# Check if accounts are funded
if [ ! -f "server/funded-accounts.json" ]; then
    echo "❌ No funded accounts found!"
    echo "   Please run: ./fund-accounts.sh 200 10"
    exit 1
fi
echo "✅ Funded accounts found"
echo ""

# Check and deposit contract balances if needed
echo "🔍 Checking contract balances..."
cd server
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node deposit-contract-balances.js 2>&1 | tail -5
cd ..
echo ""

# Check contract address
CONTRACT_ADDRESS_FILE="../Besu-hyperledger/smart_contracts/contracts/InterbankTransfer.address.txt"
if [ ! -f "$CONTRACT_ADDRESS_FILE" ]; then
    echo "⚠️  Contract address file not found, using default"
fi
echo ""

# Run test
cd server
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 \
TARGET_TPS=$TARGET_TPS \
TEST_DURATION=$DURATION \
BATCH_SIZE=50 \
node test-batch-tps.js
cd ..

echo ""
echo "✅ Test completed!"
echo ""
echo "📊 Results saved in: server/logs/batch-${TARGET_TPS}-tps-results.json"

