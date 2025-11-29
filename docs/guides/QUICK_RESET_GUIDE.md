# 🔄 Hướng Dẫn Reset Blockchain Nhanh

## 📋 Tóm Tắt: Chỉ Cần Chạy 2 Lệnh!

### Bước 1: Reset Blockchain
```bash
cd /home/quy/project/NT209_Project/Besu-hyperledger
docker-compose down -v  # Xóa volumes (blockchain data)
./run.sh                 # Khởi động lại blockchain
```

### Bước 2: Deploy Contract và Init (Tự động)
```bash
cd smart_contracts
node scripts/public/deploy_and_init.js
```

**Xong!** Script sẽ tự động:
1. ✅ Deploy contract mới
2. ✅ Authorize các bank addresses
3. ✅ Deposit 100 ETH cho tất cả users
4. ✅ Cập nhật contract address trong GUI config

---

## 🔍 Chi Tiết Từng Bước

### 1. Reset Blockchain

```bash
cd /home/quy/project/NT209_Project/Besu-hyperledger

# Dừng và xóa tất cả containers + volumes
docker-compose down -v

# Khởi động lại blockchain
./run.sh

# Đợi blockchain khởi động (khoảng 15-30 giây)
# Kiểm tra blockchain đã sẵn sàng:
curl -X POST http://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### 2. Deploy và Init Contract

```bash
cd /home/quy/project/NT209_Project/Besu-hyperledger/smart_contracts

# Script tự động làm tất cả:
node scripts/public/deploy_and_init.js
```

Script này sẽ:
- **Bước 1**: Deploy contract → Lấy contract address mới
- **Bước 2**: Authorize + Deposit cho tất cả 6 users
- **Bước 3**: Cập nhật `GUI/web/config/contracts.ts` với address mới

---

## 📝 Scripts Có Sẵn

### Script Chính (Khuyên dùng):
- **`deploy_and_init.js`**: Deploy + Init tất cả trong một lần
  ```bash
  node scripts/public/deploy_and_init.js
  ```

### Scripts Riêng Lẻ (nếu cần):

1. **Deploy contract**:
   ```bash
   node scripts/public/deploy_interbank.js
   ```

2. **Deposit cho tất cả users**:
   ```bash
   node scripts/public/deposit_user.js
   ```

3. **Init contract** (authorize + deposit):
   ```bash
   node scripts/public/init_contract.js
   ```

---

## ✅ Checklist Sau Khi Reset

- [ ] Blockchain đã chạy (`docker-compose ps` hoặc `curl http://localhost:21001`)
- [ ] Contract đã được deploy thành công
- [ ] Contract address đã được cập nhật trong `GUI/web/config/contracts.ts`
- [ ] Tất cả 6 users đã có 100 ETH trong contract
- [ ] GUI có thể load balance từ contract
- [ ] Test transfer thành công

---

## 🎯 Tóm Tắt Ngắn Gọn

**Khi reset blockchain, chỉ cần:**

```bash
# 1. Reset blockchain
cd Besu-hyperledger
docker-compose down -v && ./run.sh

# 2. Deploy và init (đợi ~15 giây cho blockchain khởi động)
cd smart_contracts
sleep 15  # Đợi blockchain khởi động
node scripts/public/deploy_and_init.js
```

**Xong! Contract đã sẵn sàng sử dụng!** 🚀
