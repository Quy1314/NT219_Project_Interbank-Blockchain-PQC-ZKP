# Smart Contract InterbankTransfer - Giải Thích

## 📋 Thông Tin Contract

- **Contract Address**: `0x42699A7612A82f1d9C36148af9C77354759b210b`
- **Network**: Private Besu Network (Chain ID: 1337)
- **Deployer**: `0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73`

---

## 🎯 Tác Dụng Chính Của Contract

Contract `InterbankTransfer` là một **hệ thống quản lý số dư và giao dịch liên ngân hàng** trên blockchain, có các chức năng:

### 1. **Quản Lý Số Dư (Balance Management)**
   - Lưu trữ số dư của từng user trên blockchain (immutable, transparent)
   - Mỗi user có một số dư riêng biệt được quản lý bởi contract
   - Số dư được cập nhật tự động khi có giao dịch

### 2. **Chuyển Tiền Liên Ngân Hàng (Interbank Transfer)**
   - **`transfer()`**: Chức năng chính để chuyển tiền giữa các user
   - **Tự động trừ/cộng số dư**: Khi chuyển tiền, contract tự động:
     - Trừ tiền từ người gửi (`balances[from] -= amount`)
     - Cộng tiền vào người nhận (`balances[to] += amount`)
   - **Atomic transaction**: Tất cả hoặc không có gì - đảm bảo tính toàn vẹn
   - **Kiểm tra số dư**: Tự động kiểm tra số dư đủ trước khi chuyển

### 3. **Nạp Tiền (Deposit)**
   - **`deposit()`**: Cho phép authorized banks nạp tiền vào tài khoản user
   - Chỉ các bank được ủy quyền mới có thể nạp tiền
   - Có thể gửi ETH kèm theo hàm này (payable function)

### 4. **Theo Dõi Giao Dịch (Transaction Tracking)**
   - Lưu trữ toàn bộ lịch sử giao dịch trên blockchain
   - Mỗi giao dịch có:
     - ID duy nhất
     - Người gửi và người nhận
     - Số tiền
     - Mã ngân hàng
     - Mô tả
     - Timestamp
     - Trạng thái (Pending/Processing/Completed/Failed)

### 5. **Events & Notifications**
   - Phát events khi có giao dịch để các ứng dụng khác có thể lắng nghe:
     - `Transfer`: Khi có chuyển tiền
     - `Deposit`: Khi có nạp tiền
     - `BalanceUpdated`: Khi số dư thay đổi
     - `TransactionStatusChanged`: Khi trạng thái giao dịch thay đổi

### 6. **Truy Vấn Dữ Liệu (Query Functions)**
   - `getBalance(address)`: Lấy số dư của một user
   - `getTransaction(uint256)`: Lấy thông tin chi tiết một giao dịch
   - `getUserTransactions(address)`: Lấy danh sách giao dịch của một user
   - `getTransactionCount()`: Lấy tổng số giao dịch

---

## 🔐 Bảo Mật & Authorization

- **Owner**: Người deploy contract có quyền cao nhất
- **Authorized Banks**: Các bank được ủy quyền có thể:
  - Nạp tiền cho user
  - Cập nhật trạng thái giao dịch
- **Public Functions**: 
  - `transfer()`: Mọi người có thể gọi (với số dư đủ)
  - `getBalance()`, `getTransaction()`: Read-only, không cần authorization

---

## 💡 Lợi Ích So Với Native Transfer

### **Native ETH Transfer** (cách cũ):
- ❌ Chỉ chuyển ETH trực tiếp
- ❌ Không có lịch sử giao dịch chi tiết
- ❌ Không có thông tin ngân hàng
- ❌ Không có trạng thái giao dịch

### **Smart Contract Transfer** (cách mới):
- ✅ Quản lý số dư tập trung
- ✅ Lịch sử giao dịch đầy đủ trên blockchain
- ✅ Theo dõi ngân hàng gửi/nhận
- ✅ Trạng thái giao dịch rõ ràng
- ✅ Events để notify các hệ thống khác
- ✅ Dễ dàng audit và kiểm tra

---

## 🚀 Cách GUI Sử Dụng Contract

1. **Khi Transfer**:
   - GUI gọi `transfer(to, amount, toBankCode, description)`
   - Contract tự động trừ/cộng số dư
   - Contract phát `Transfer` event
   - GUI lắng nghe event để cập nhật UI

2. **Khi Check Balance**:
   - GUI gọi `getBalance(userAddress)`
   - Contract trả về số dư từ blockchain
   - Không cần query từ file JSON nữa

3. **Khi Xem History**:
   - GUI gọi `getUserTransactions(userAddress)`
   - Contract trả về danh sách transaction IDs
   - GUI gọi `getTransaction(id)` cho từng transaction

---

## 📊 So Sánh: Contract vs Native Transfer

| Tính năng | Native Transfer | Smart Contract |
|-----------|----------------|----------------|
| Số dư | Lưu trên blockchain (ETH) | Lưu trong contract mapping |
| Lịch sử | Phải tự lưu LocalStorage | Có sẵn trong contract |
| Ngân hàng | Không có thông tin | Có bank code |
| Events | Không có | Có đầy đủ events |
| Audit | Khó kiểm tra | Dễ audit trên blockchain |
| Tốc độ | Nhanh hơn | Hơi chậm hơn (do contract logic) |

---

## ✅ Contract Đã Được Deploy

Contract address đã được lưu vào:
- File: `Besu-hyperledger/smart_contracts/contracts/InterbankTransfer.address.txt`
- GUI Config: `GUI/web/config/contracts.ts` (đã cập nhật)

GUI sẽ tự động sử dụng contract khi detect được contract address!
