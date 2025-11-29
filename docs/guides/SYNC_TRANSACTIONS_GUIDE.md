# Hướng Dẫn Sync Transactions Lên Blockchain - Tóm Tắt

## 🔍 Vấn Đề Đã Được Khắc Phục

### 1. **Lỗi Quản Lý Nonce** (Quan trọng nhất)

**Vấn đề:**
- Khi sync nhiều transactions cùng lúc, blockchain sẽ từ chối các giao dịch sau giao dịch đầu tiên
- Lỗi: "Nonce too low" hoặc "Replacement transaction underpriced"
- Nguyên nhân: Các transaction cùng dùng một nonce

**Giải pháp:**
- ✅ Nhóm transactions theo sender address
- ✅ Lấy nonce hiện tại từ blockchain cho mỗi sender
- ✅ Tăng nonce sau mỗi transaction thành công
- ✅ Xử lý tuần tự từng sender (không parallel)
- ✅ Tự động reset nonce nếu gặp lỗi

### 2. **Quản Lý Nonce Thủ Công**

```typescript
// Lấy nonce hiện tại từ blockchain
let currentNonce = await provider.getTransactionCount(senderAddress, 'latest');

// Gửi transaction với nonce thủ công
const txResponse = await wallet.sendTransaction({
  to: transaction.to,
  value: amountWei,
  nonce: currentNonce, // Sử dụng nonce được quản lý thủ công
  gasLimit: 21000,
  gasPrice: 0, // Free gas for private blockchain
});

// Tăng nonce cho transaction tiếp theo
currentNonce++;
```

### 3. **Nhóm Transactions Theo Sender**

```typescript
// Nhóm transactions theo người gửi
const txsBySender: Record<string, Transaction[]> = {};

transactionsToSync.forEach((item) => {
  const senderAddress = item.transaction.from.toLowerCase();
  if (!txsBySender[senderAddress]) {
    txsBySender[senderAddress] = [];
  }
  txsBySender[senderAddress].push(item);
});

// Xử lý tuần tự từng sender
for (const senderAddress of Object.keys(txsBySender)) {
  const userTxs = txsBySender[senderAddress];
  // Lấy nonce và xử lý từng transaction
}
```

## 📋 Flow Xử Lý

1. **Lấy tất cả transactions cần sync** từ LocalStorage
2. **Nhóm theo sender address** để quản lý nonce riêng
3. **Xử lý tuần tự từng sender:**
   - Lấy nonce hiện tại từ blockchain
   - Với mỗi transaction:
     - Gửi với nonce hiện tại
     - Đợi confirmation (1 block)
     - Tăng nonce lên 1
     - Update transaction với txHash thật
4. **Xử lý lỗi:**
   - Nếu lỗi nonce → reset nonce từ blockchain
   - Nếu không reset được → skip các transaction còn lại

## 🔧 Cấu Hình

### Private Blockchain (Không tốn Gas)

```typescript
// config/blockchain.ts
export const GAS_PRICE = '0x0'; // Free gas for test network

// Khi gửi transaction
const txResponse = await wallet.sendTransaction({
  to: transaction.to,
  value: amountWei,
  nonce: currentNonce,
  gasLimit: 21000,
  gasPrice: 0, // Free gas for private test network
});
```

### Delay Giữa Transactions

- **500ms** giữa các transactions của cùng sender
- **1000ms** giữa các senders khác nhau
- Giúp blockchain có thời gian xử lý

## ✅ Các Cải Thiện Đã Áp Dụng

1. ✅ **Quản lý Nonce thủ công** - Tránh lỗi "nonce too low"
2. ✅ **Nhóm theo sender** - Mỗi sender có nonce riêng
3. ✅ **Xử lý tuần tự** - Không parallel để tránh conflict nonce
4. ✅ **Tự động reset nonce** - Khi gặp lỗi nonce
5. ✅ **Delay giữa transactions** - Đảm bảo blockchain xử lý được
6. ✅ **Xử lý lỗi chi tiết** - Log và báo cáo lỗi rõ ràng

## 🎯 Sử Dụng

1. Vào bất kỳ bank nào (VCB, VTB, BIDV)
2. Click **"Sync Blockchain"** trong sidebar
3. Xem danh sách transactions cần sync
4. Click **"Sync Tất Cả Giao Dịch"**
5. Chờ quá trình sync hoàn tất
6. Xem kết quả chi tiết (success/failed/skipped)

## ⚠️ Lưu Ý

- **Private blockchain không tốn gas** (gasPrice = 0)
- **Cần có số dư** trên blockchain để thực hiện giao dịch
- **Nonce được quản lý riêng** cho từng sender
- **Transactions được xử lý tuần tự** để tránh conflict
- **Với Mock Mode bật**, có thể cần tắt để sync thật

## 🐛 Troubleshooting

### Lỗi "Nonce too low"
- ✅ Đã được xử lý tự động - nonce sẽ được reset

### Lỗi "Replacement transaction underpriced"
- ✅ Đã được xử lý tự động - nonce sẽ được reset

### Transaction bị skip
- Kiểm tra xem transaction đã có txHash thật chưa
- Kiểm tra số dư trên blockchain

### Sync chậm
- Delay 500ms-1000ms giữa transactions là bình thường
- Đảm bảo blockchain có đủ thời gian xử lý

