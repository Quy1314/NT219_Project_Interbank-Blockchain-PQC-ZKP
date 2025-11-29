# 🔄 Hướng Dẫn Reset Blockchain và Deploy Lại Contract

## ⚠️ Khi nào cần reset blockchain?

- Khi muốn bắt đầu lại từ đầu
- Khi blockchain bị lỗi và cần fresh start
- Khi test lại từ genesis block

## 🔍 Điều gì xảy ra khi reset blockchain?

1. **Tất cả dữ liệu trên blockchain bị mất**:
   - ✅ Transactions cũ
   - ✅ Contract đã deploy (mất địa chỉ contract)
   - ✅ Số dư trong contract mapping
   
2. **Những gì KHÔNG bị mất** (nếu reset đúng cách):
   - ✅ Genesis accounts và private keys (nếu không xóa)
   - ✅ Code source và compiled contracts
   - ✅ Scripts deploy

## 📋 Các Bước Reset và Deploy Lại

### Cách 1: Sử dụng Script Tự Động (Khuyên dùng) ✅

```bash
cd Besu-hyperledger/smart_contracts
node scripts/public/deploy_and_init.js
```

Script này sẽ tự động:
1. ✅ Deploy contract mới
2. ✅ Authorize các bank addresses
3. ✅ Deposit số dư ban đầu cho tất cả users
4. ✅ Cập nhật contract address trong GUI config

### Cách 2: Thực Hiện Thủ Công

#### Bước 1: Deploy Contract
```bash
cd Besu-hyperledger/smart_contracts
node scripts/public/deploy_interbank.js
```

Lưu lại contract address (ví dụ: `0x42699A7612A82f1d9C36148af9C77354759b210b`)

#### Bước 2: Cập Nhật Contract Address
Cập nhật trong file `GUI/web/config/contracts.ts`:
```typescript
export const INTERBANK_TRANSFER_ADDRESS = 
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x42699A7612A82f1d9C36148af9C77354759b210b';
```

#### Bước 3: Khởi Tạo Contract
```bash
export CONTRACT_ADDRESS=0x42699A7612A82f1d9C36148af9C77354759b210b
node scripts/public/init_contract.js
```

## 🔧 Reset Blockchain

### Nếu dùng Docker:
```bash
cd Besu-hyperledger
docker-compose down -v  # Xóa volumes (bao gồm blockchain data)
docker-compose up -d    # Khởi động lại
```

### Nếu chạy trực tiếp:
- Xóa thư mục data của Besu
- Restart Besu node

## ✅ Checklist Sau Khi Reset

- [ ] Blockchain đã chạy và sync xong
- [ ] Deploy contract mới thành công
- [ ] Contract address đã được cập nhật trong GUI config
- [ ] Đã chạy script init để deposit số dư
- [ ] GUI có thể kết nối và lấy balance từ contract
- [ ] Test transfer thành công

## 🎯 Tóm Tắt

**Có, khi reset blockchain bạn PHẢI:**
1. ✅ Deploy lại contract (vì contract bị mất)
2. ✅ Cập nhật contract address mới trong GUI config
3. ✅ Chạy lại script init để deposit số dư cho users

**Hoặc đơn giản hơn, chỉ cần chạy:**
```bash
node scripts/public/deploy_and_init.js
```

Script sẽ làm tất cả tự động! 🚀
