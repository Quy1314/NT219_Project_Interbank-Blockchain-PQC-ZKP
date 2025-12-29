#!/bin/bash

# Script to fund accounts for benchmark
# Usage: ./fund-accounts.sh [num_accounts] [fund_amount_eth]

set -e

NUM_ACCOUNTS=${1:-200}
FUND_AMOUNT_ETH=${2:-10}

echo "=========================================="
echo "💰 FUNDING ACCOUNTS FOR BENCHMARK"
echo "=========================================="
echo ""
echo "📋 Config:"
echo "   Number of accounts: $NUM_ACCOUNTS"
echo "   Fund amount: $FUND_AMOUNT_ETH ETH per account"
echo "   Total needed: $(echo "$NUM_ACCOUNTS * $FUND_AMOUNT_ETH" | bc) ETH"
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

# Run fund script
cd server
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 \
PRIVATE_KEY=0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63 \
NUM_ACCOUNTS=$NUM_ACCOUNTS \
FUND_AMOUNT_ETH=$FUND_AMOUNT_ETH \
node fund-benchmark-accounts.js
cd ..

echo ""
echo "✅ Funding complete!"
echo ""
echo "📊 Next steps:"
echo "   1. Deposit contract balances: cd server && node deposit-contract-balances.js"
echo "   2. Register PKI (if enabled): cd server && node register-pki-accounts.js"
echo "   3. Run benchmark: ./test-batch-tps.sh [20|40|50]"

