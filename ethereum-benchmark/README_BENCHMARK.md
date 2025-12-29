# Benchmark với Batch Transactions

Hướng dẫn fund accounts và test các mốc 20, 40, 50 TPS với batch transactions.

## 🚀 Quick Start

### 1. Fund Accounts

```bash
cd ethereum-benchmark
./fund-accounts.sh 200 10
```

**Tham số:**
- `200` - Số lượng accounts cần fund
- `10` - Số ETH mỗi account

**Kết quả:**
- Fund 200 accounts với 10 ETH mỗi account
- Tổng cần: 2000 ETH từ owner account
- Accounts được lưu vào `server/funded-accounts.json`

### 2. Deposit Contract Balances (Nếu PKI enabled)

```bash
cd server
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node deposit-contract-balances.js
cd ..
```

### 3. Register PKI Accounts (Nếu PKI enabled)

```bash
cd server
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node register-pki-accounts.js
cd ..
```

### 4. Test Batch Transactions

**Test 20 TPS:**
```bash
./test-batch-tps.sh 20 60
```

**Test 40 TPS:**
```bash
./test-batch-tps.sh 40 60
```

**Test 50 TPS:**
```bash
./test-batch-tps.sh 50 60
```

**Tham số:**
- `20|40|50` - Target TPS
- `60` - Duration (seconds)

## 📊 Chạy Tất Cả Tests

```bash
./run-all-benchmarks.sh
```

Script này sẽ:
1. Fund accounts (200 accounts × 10 ETH)
2. Deposit contract balances (optional)
3. Register PKI accounts (optional)
4. Chạy tests cho 20, 40, 50 TPS

## 📈 Kết Quả

Kết quả được lưu trong `server/logs/`:
- `batch-20-tps-results.json`
- `batch-40-tps-results.json`
- `batch-50-tps-results.json`

**Metrics:**
- Actual TPS
- Success Rate
- Total Batches
- Successful/Failed Batches
- Total Transfers
- Average Latency

## 🔧 Cấu Hình

**Batch Size:** 50 transfers per batch (có thể điều chỉnh trong script)

**Cách tính Batch Rate:**
- Target: 50 TPS
- Batch Size: 50 transfers
- Required: 50 / 50 = 1 batch/second
- Interval: 1000ms between batches

**Để đạt 50 TPS:**
- Batch 50 transfers → 1 batch/second = 50 TPS
- Hoặc batch 200 transfers → 1 batch/4s = 50 TPS

## ⚠️ Lưu Ý

1. **Blockchain phải đang chạy:**
   ```bash
   cd Besu-hyperledger
   docker ps | grep besu
   ```

2. **Contract phải đã deploy:**
   ```bash
   cat Besu-hyperledger/smart_contracts/contracts/InterbankTransfer.address.txt
   ```

3. **Owner account cần đủ ETH:**
   - 200 accounts × 10 ETH = 2000 ETH
   - Nếu PKI enabled: +2000 ETH cho contract deposits = 4000 ETH total

4. **Gas Limit:**
   - Batch transactions cần gas limit cao (16,000,000)
   - Đã được set trong script

5. **Nonce Management:**
   - Script tự động quản lý nonce
   - Mỗi batch dùng một account khác nhau để tránh conflicts

## 📝 Ví Dụ Output

```
🚀 BATCH TRANSACTION BENCHMARK TEST
================================================================================

📋 Configuration:
   Target TPS: 50
   Batch Size: 50 transfers per batch
   Test Duration: 60 seconds
   Contract Address: 0x...
   Funded Accounts: 200

📊 Batch Rate Calculation:
   Target: 50 TPS
   Batch Size: 50 transfers
   Required: 1.00 batches/second
   Interval: 1000ms between batches

🚀 Starting benchmark...

✅ Batch 1: 50 transfers in 3421ms (tx: 0x1234...)
✅ Batch 2: 50 transfers in 3892ms (tx: 0x5678...)
...

================================================================================
📊 BENCHMARK RESULTS
================================================================================

Target TPS: 50
Actual TPS: 48.75
Success Rate: 100.00%
Total Batches: 60
Successful Batches: 60
Failed Batches: 0
Total Transfers: 3000
Successful Transfers: 3000
Failed Transfers: 0
Average Latency: 3654.23ms per batch
Test Duration: 60.00 seconds

✅ SUCCESS: Achieved target TPS!
```

