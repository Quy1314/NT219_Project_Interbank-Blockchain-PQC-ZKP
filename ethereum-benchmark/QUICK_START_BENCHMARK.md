# Quick Start Benchmark - Batch Transactions

## ⚠️ QUAN TRỌNG: Contract Phải Có Function `batchTransfer`

Contract hiện tại (`0x42699A7612A82f1d9C36148af9C77354759b210b`) **CHƯA CÓ** function `batchTransfer` trong bytecode.

**Cần re-deploy contract trước khi test!**

## 🚀 Các Bước

### 1. Re-deploy Contract (BẮT BUỘC)

```bash
cd ethereum-benchmark
./redeploy-contract.sh
```

Hoặc thủ công:

```bash
cd Besu-hyperledger/smart_contracts
node scripts/compile.js
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/public/deploy_and_init.js
unset NODE_TLS_REJECT_UNAUTHORIZED
```

### 2. Tắt PKI (Khuyên dùng cho benchmark hiệu năng)

```bash
cd ethereum-benchmark
./disable-pki-for-benchmark.sh
```

### 3. Fund Accounts

```bash
cd ethereum-benchmark
./fund-accounts.sh 200 10
```

### 4. Deposit Contract Balances

```bash
cd ethereum-benchmark/server
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node deposit-contract-balances.js
cd ..
```

### 5. Test Batch Transactions

```bash
# Test 20 TPS
./test-batch-tps.sh 20 60

# Test 40 TPS
./test-batch-tps.sh 40 60

# Test 50 TPS
./test-batch-tps.sh 50 60
```

## 📊 Kết Quả

Kết quả được lưu trong `server/logs/`:
- `batch-20-tps-results.json`
- `batch-40-tps-results.json`
- `batch-50-tps-results.json`

## ⚠️ Lưu Ý

1. **Contract phải được re-deploy** với code mới có `batchTransfer`
2. **PKI nên tắt** để test hiệu năng (không phải security)
3. **Accounts phải có balance** trong contract (không chỉ native ETH)
4. **Recipients phải khác sender** (contract check "Cannot transfer to yourself")

## 🔧 Troubleshooting

**Lỗi: "Execution reverted"**
- Kiểm tra contract có function `batchTransfer`: `node debug-batch-transfer.js`
- Kiểm tra PKI status: Contract có thể cần tắt PKI
- Kiểm tra balance: Accounts phải có balance trong contract

**Lỗi: "Contract has batchTransfer: false"**
- Contract cần được re-deploy với code mới
- Chạy: `./redeploy-contract.sh`

