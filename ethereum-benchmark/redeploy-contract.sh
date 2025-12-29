#!/bin/bash

# Script to re-deploy InterbankTransfer contract with batchTransfer function
# Usage: ./redeploy-contract.sh

set -e

echo "=========================================="
echo "🔄 RE-DEPLOYING CONTRACT WITH BATCH TRANSFER"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This will deploy a new contract!"
echo "   Old contract address will be replaced."
echo ""

read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

cd ../Besu-hyperledger/smart_contracts

echo ""
echo "📋 Step 1: Compiling contract..."
node scripts/compile.js

echo ""
echo "📋 Step 2: Deploying contract..."
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/public/deploy_and_init.js
unset NODE_TLS_REJECT_UNAUTHORIZED

echo ""
echo "✅ Contract re-deployed!"
echo ""
echo "📋 Next steps:"
echo "   1. Update contract address in benchmark:"
echo "      - Update docker-compose.interbank.yml"
echo "      - Update test scripts"
echo "   2. Fund accounts again if needed"
echo "   3. Run benchmark: ./test-batch-tps.sh 20 60"

