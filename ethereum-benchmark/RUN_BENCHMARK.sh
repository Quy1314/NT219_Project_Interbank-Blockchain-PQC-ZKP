#!/bin/bash

# Script to run InterbankTransfer benchmark with Lacchain Ethereum-Benchmark
# Usage: ./RUN_BENCHMARK.sh [tps] [minutes]

set -e

echo "=========================================="
echo "🚀 InterbankTransfer Benchmark với Lacchain"
echo "=========================================="

# Default values
TPS=${1:-1}
MINUTES=${2:-1}

# Contract address
CONTRACT_ADDRESS_FILE="../Besu-hyperledger/smart_contracts/contracts/InterbankTransfer.address.txt"
if [ -f "$CONTRACT_ADDRESS_FILE" ]; then
    CONTRACT_ADDRESS=$(cat "$CONTRACT_ADDRESS_FILE" | tr -d '\n')
    echo "✅ Contract Address: $CONTRACT_ADDRESS"
else
    echo "⚠️  Contract address file not found, using default: 0x42699A7612A82f1d9C36148af9C77354759b210b"
    CONTRACT_ADDRESS="0x42699A7612A82f1d9C36148af9C77354759b210b"
fi

# Update docker-compose with contract address
sed -i "s|INTERBANK_CONTRACT_ADDRESS=.*|INTERBANK_CONTRACT_ADDRESS=$CONTRACT_ADDRESS|g" docker-compose.interbank.yml
sed -i "s|DESIRED_RATE_TX=.*|DESIRED_RATE_TX=$TPS|g" docker-compose.interbank.yml
sed -i "s|TEST_TIME_MINUTES=.*|TEST_TIME_MINUTES=$MINUTES|g" docker-compose.interbank.yml

echo "📊 Benchmark Configuration:"
echo "   TPS: $TPS transactions/second"
echo "   Duration: $MINUTES minutes"
echo "   Contract: $CONTRACT_ADDRESS"
echo ""

# Check if logs directory exists
mkdir -p server/logs

# Run benchmark
echo "🚀 Starting benchmark..."
docker-compose -f docker-compose.interbank.yml up --build

echo ""
echo "✅ Benchmark completed!"
echo "📊 Results saved in: server/logs/"
echo ""
echo "📋 Log files:"
ls -lh server/logs/ | tail -5

