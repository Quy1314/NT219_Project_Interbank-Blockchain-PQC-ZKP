#!/bin/bash

# Script to disable PKI for benchmark testing
# Usage: ./disable-pki-for-benchmark.sh

set -e

echo "=========================================="
echo "🔧 DISABLING PKI FOR BENCHMARK"
echo "=========================================="
echo ""

cd ../Besu-hyperledger/smart_contracts

export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/public/toggle_pki.js false
unset NODE_TLS_REJECT_UNAUTHORIZED

echo ""
echo "✅ PKI disabled!"
echo ""
echo "💡 To re-enable PKI:"
echo "   cd Besu-hyperledger/smart_contracts"
echo "   export NODE_TLS_REJECT_UNAUTHORIZED=0"
echo "   RPC_ENDPOINT=https://localhost:21001 node scripts/public/toggle_pki.js true"
echo ""

