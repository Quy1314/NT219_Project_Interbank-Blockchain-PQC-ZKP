#!/bin/bash

# Script to fund accounts and run all benchmark tests (20, 40, 50 TPS)
# Usage: ./run-all-benchmarks.sh

set -e

echo "=========================================="
echo "🚀 COMPLETE BENCHMARK TEST SUITE"
echo "=========================================="
echo ""

# Step 1: Fund accounts
echo "📋 Step 1: Funding accounts..."
echo ""
./fund-accounts.sh 200 10

if [ $? -ne 0 ]; then
    echo "❌ Failed to fund accounts!"
    exit 1
fi

echo ""
echo "✅ Accounts funded successfully!"
echo ""

# Step 2: Deposit contract balances (if needed)
read -p "Do you want to deposit contract balances? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "📋 Depositing contract balances..."
    cd server
    export NODE_TLS_REJECT_UNAUTHORIZED=0
    RPC_ENDPOINT=https://localhost:21001 node deposit-contract-balances.js
    cd ..
    echo ""
fi

# Step 3: Register PKI (if needed)
read -p "Do you want to register PKI accounts? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "📋 Registering PKI accounts..."
    cd server
    export NODE_TLS_REJECT_UNAUTHORIZED=0
    RPC_ENDPOINT=https://localhost:21001 node register-pki-accounts.js
    cd ..
    echo ""
fi

# Step 4: Run benchmarks
echo "=========================================="
echo "🚀 RUNNING BENCHMARK TESTS"
echo "=========================================="
echo ""

# Test 20 TPS
echo "📊 Test 1: 20 TPS (60 seconds)"
echo "----------------------------------------"
./test-batch-tps.sh 20 60
echo ""

# Wait a bit between tests
echo "⏳ Waiting 10 seconds before next test..."
sleep 10
echo ""

# Test 40 TPS
echo "📊 Test 2: 40 TPS (60 seconds)"
echo "----------------------------------------"
./test-batch-tps.sh 40 60
echo ""

# Wait a bit between tests
echo "⏳ Waiting 10 seconds before next test..."
sleep 10
echo ""

# Test 50 TPS
echo "📊 Test 3: 50 TPS (60 seconds)"
echo "----------------------------------------"
./test-batch-tps.sh 50 60
echo ""

echo "=========================================="
echo "✅ ALL BENCHMARK TESTS COMPLETED"
echo "=========================================="
echo ""
echo "📊 Results saved in: server/logs/"
echo "   - batch-20-tps-results.json"
echo "   - batch-40-tps-results.json"
echo "   - batch-50-tps-results.json"
echo ""

