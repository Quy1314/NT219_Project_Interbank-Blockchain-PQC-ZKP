# GUI Architecture - Các File Liên Quan Đến Logic

## 📁 Cấu Trúc Thư Mục

```
GUI/web/
├── app/                          # Next.js App Router
│   ├── bank/[bankCode]/         # Routes cho từng ngân hàng
│   │   ├── dashboard/           # Dashboard
│   │   ├── transfer/            # Chuyển tiền
│   │   ├── withdraw/            # Rút tiền
│   │   ├── history/             # Lịch sử
│   │   ├── statement/           # Sao kê
│   │   └── layout.tsx           # Layout cho bank routes
│   ├── api/                     # API Routes
│   │   └── balances/            # API load balances
│   └── layout.tsx               # Root layout
├── components/                   # React Components
│   ├── layout/                  # Layout components
│   │   ├── Header.tsx           # Header với navigation
│   │   └── Sidebar.tsx          # Sidebar menu
│   └── UserSelector.tsx         # User selector dropdown
├── config/                      # Configuration
│   ├── banks.ts                 # ⭐ Bank và user config
│   └── blockchain.ts            # ⭐ Blockchain RPC config & conversion
├── lib/                         # Utilities & Logic
│   ├── blockchain.ts            # ⭐ Blockchain interaction
│   ├── balances.ts              # Balance loading logic
│   └── storage.ts               # ⭐ LocalStorage management
├── types/                       # TypeScript Types
│   └── transaction.ts           # Transaction types
└── public/                      # Static files
    └── user_balances.json       # Balance data
```

## 🔑 Các File Logic Chính

### 1. **Configuration Files**

#### `config/banks.ts` ⭐
- **Chức năng**: Định nghĩa cấu hình cho 3 ngân hàng (Vietcombank, VietinBank, BIDV)
- **Nội dung**:
  - `BankConfig` interface
  - `BankUser` interface
  - `BANKS` array với thông tin ngân hàng và users
  - `getBankByCode()` - Lấy bank theo code
  - `getAllUsers()` - Lấy tất cả users

#### `config/blockchain.ts` ⭐
- **Chức năng**: Cấu hình blockchain RPC và conversion rates
- **Nội dung**:
  - RPC endpoints (HTTP, WebSocket)
  - Chain ID
  - Gas configuration
  - **Conversion functions**:
    - `vndToWei()` - Convert VND → Wei
    - `weiToVnd()` - Convert Wei → VND
    - `formatVND()` - Format số tiền VND
  - Constants:
    - `ETH_TO_VND_RATE = 1000` (1 ETH = 1,000 VND)
    - `INITIAL_ETH_BALANCE = 100000` (100K ETH)
    - `INITIAL_VND_BALANCE = 100000000` (100 triệu VND)

### 2. **Business Logic Files**

#### `lib/blockchain.ts` ⭐
- **Chức năng**: Tất cả logic liên quan đến blockchain
- **Functions**:
  - `getProvider()` - Tạo/kết nối blockchain provider
  - `getWallet()` - Tạo wallet từ private key
  - `getBalance()` - Lấy balance từ blockchain (wei)
  - `getBalanceVND()` - Lấy balance và convert sang VND
  - `sendTransaction()` - Gửi transaction lên blockchain
  - `waitForTransaction()` - Chờ transaction được confirm
  - `formatAddress()` - Format địa chỉ ví

#### `lib/storage.ts` ⭐
- **Chức năng**: Quản lý LocalStorage cho transactions và user data
- **Functions**:
  - `saveTransaction()` - Lưu transaction (theo bank + user)
  - `getTransactionsByUser()` - Lấy transactions của user (theo bank)
  - `updateTransactionStatus()` - Cập nhật trạng thái transaction
  - `deleteTransactionsByUser()` - Xóa tất cả transactions
  - `deleteTransaction()` - Xóa 1 transaction
  - `generateReferenceCode()` - Tạo mã tham chiếu
  - `setSelectedUser()` / `getSelectedUser()` - Quản lý user đang chọn
  - `setSelectedBank()` / `getSelectedBank()` - Quản lý bank đang chọn
- **Storage Keys**:
  - `interbank_transactions_{bankCode}_{address}` - Transactions theo bank+user

#### `lib/balances.ts`
- **Chức năng**: Load balance từ file JSON
- **Functions**:
  - `loadBalances()` - Load từ API hoặc file
  - `getBalanceForUser()` - Lấy balance của user từ file
  - `updateUserBalance()` - Cập nhật balance (cache)

### 3. **Type Definitions**

#### `types/transaction.ts`
- **Chức năng**: Định nghĩa types cho transactions
- **Types**:
  - `Transaction` - Transaction data structure
  - `TransactionType` - 'transfer' | 'withdrawal'
  - `TransactionStatus` - 'pending' | 'processing' | 'completed' | 'failed'
  - `TransferForm` - Form data cho chuyển tiền
  - `WithdrawalForm` - Form data cho rút tiền
  - `StatementPeriod` - Period cho sao kê

### 4. **Page Components (Logic)**

#### `app/bank/[bankCode]/dashboard/page.tsx` ⭐
- **Chức năng**: Dashboard hiển thị tổng quan
- **Logic**:
  - Load balance (file → blockchain)
  - Load transactions của user
  - Tính toán statistics
  - Hiển thị recent transactions

#### `app/bank/[bankCode]/transfer/page.tsx` ⭐
- **Chức năng**: Chuyển tiền
- **Logic**:
  - Validate form input
  - Generate OTP (mock)
  - Verify OTP
  - Send transaction lên blockchain
  - Save transaction vào localStorage
  - Update transaction status

#### `app/bank/[bankCode]/withdraw/page.tsx` ⭐
- **Chức năng**: Rút tiền
- **Logic**:
  - Validate form input
  - Chọn phương thức (ATM/Branch)
  - Generate OTP (mock)
  - Tạo withdrawal transaction
  - Save vào localStorage

#### `app/bank/[bankCode]/history/page.tsx` ⭐
- **Chức năng**: Lịch sử giao dịch
- **Logic**:
  - Load transactions của user (theo bank)
  - Filter theo: search, type, status, date
  - Delete transaction
  - Delete all transactions

#### `app/bank/[bankCode]/statement/page.tsx` ⭐
- **Chức năng**: Sao kê
- **Logic**:
  - Filter transactions theo period (month/quarter/custom)
  - Tính toán tổng hợp
  - Generate PDF/CSV export

#### `app/bank/[bankCode]/layout.tsx` ⭐
- **Chức năng**: Layout cho bank routes
- **Logic**:
  - Load selected user
  - User selector
  - Redirect to dashboard if needed

### 5. **API Routes**

#### `app/api/balances/route.ts`
- **Chức năng**: API endpoint để load balances
- **Logic**:
  - Read `user_balances.json` từ public folder
  - Return JSON data
  - Fallback to default balances if file not found

### 6. **UI Components**

#### `components/layout/Header.tsx`
- **Chức năng**: Header với navigation
- **Logic**:
  - Hiển thị tên bank hiện tại
  - Navigation links đến các bank

#### `components/layout/Sidebar.tsx`
- **Chức năng**: Sidebar menu
- **Logic**:
  - Menu items cho 4 chức năng
  - Active state highlighting

#### `components/UserSelector.tsx`
- **Chức năng**: Dropdown chọn user
- **Logic**:
  - Show/hide dropdown
  - Select user và save vào localStorage

## 📊 Data Flow

### Balance Loading Flow:
```
1. Component mounts
2. Set default balance = 100,000,000 VND
3. Load from file (user_balances.json)
4. Try load from blockchain
5. Update balance state
```

### Transaction Flow:
```
1. User fills form
2. Generate OTP (mock)
3. Verify OTP
4. Create transaction object
5. Save to localStorage (by bank + user)
6. Send to blockchain
7. Update transaction status
8. Show success/error message
```

### Storage Structure:
```
localStorage:
  - interbank_selected_user: userId
  - interbank_selected_bank: bankCode
  - interbank_transactions_{bankCode}_{address}: [transactions]
```

## 🔄 Key Features

1. **Mỗi bank có ledger riêng**
   - Storage key: `{bankCode}_{address}`
   - Transactions không chia sẻ giữa các bank

2. **Balance Management**
   - Default: 100,000,000 VND
   - Load từ file: `user_balances.json`
   - Update từ blockchain nếu có kết nối

3. **Conversion Rate**
   - 1 ETH = 1,000 VND
   - 100,000 ETH = 100,000,000 VND (100 triệu)

## 📝 Files Cần Sửa Khi Thay Đổi Logic

- **Bank config**: `config/banks.ts`
- **Blockchain config**: `config/blockchain.ts`
- **Blockchain logic**: `lib/blockchain.ts`
- **Storage logic**: `lib/storage.ts`
- **Balance logic**: `lib/balances.ts`
- **Transaction types**: `types/transaction.ts`

