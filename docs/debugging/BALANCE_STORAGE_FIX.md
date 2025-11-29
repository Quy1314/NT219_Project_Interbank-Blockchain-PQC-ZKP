# Cập Nhật Số Dư Từ LocalStorage - Tóm Tắt

## 🔍 Vấn Đề

Khi chuyển khoản thành công, số dư (balances) và sao kê (Statement) không cập nhật vì:

1. **Blockchain không thay đổi**: Khi dùng Mock Mode hoặc blockchain không có tiền thật, blockchain không biết về giao dịch
2. **File JSON là tĩnh**: File `user_balances.json` không thể tự động cập nhật
3. **Thiếu cơ chế lưu số dư mới**: Ứng dụng chỉ lưu lịch sử giao dịch, không lưu số dư mới

## ✅ Giải Pháp Đã Áp Dụng

### Bước 1: Thêm hàm lưu/tải số dư vào `lib/storage.ts`

```typescript
// Thêm vào cuối file
const BALANCE_KEY_PREFIX = 'interbank_balance_';

export const saveUserBalance = (address: string, balance: number): void => {
  localStorage.setItem(
    `${BALANCE_KEY_PREFIX}${address.toLowerCase()}`,
    balance.toString()
  );
};

export const getStoredBalance = (address: string): number | null => {
  const stored = localStorage.getItem(`${BALANCE_KEY_PREFIX}${address.toLowerCase()}`);
  return stored ? parseFloat(stored) : null;
};

export const clearUserBalance = (address: string): void => {
  localStorage.removeItem(`${BALANCE_KEY_PREFIX}${address.toLowerCase()}`);
};
```

### Bước 2: Cập nhật `lib/balances.ts`

Sửa `getBalanceForUser()` để ưu tiên lấy từ LocalStorage:

```typescript
export const getBalanceForUser = async (userAddress: string): Promise<number | null> => {
  // 1. Ưu tiên: Kiểm tra LocalStorage (số dư mới nhất sau giao dịch)
  const storedBalance = getStoredBalance(userAddress);
  if (storedBalance !== null) {
    return storedBalance;
  }

  // 2. Nếu không có, mới load từ cache/file/api
  const balances = await loadBalances();
  const userBalance = balances.find(
    (b) => b.address.toLowerCase() === userAddress.toLowerCase()
  );
  return userBalance?.balance_vnd || null;
};
```

### Bước 3: Cập nhật `Transfer.tsx`

Sau khi giao dịch thành công, tính toán và lưu số dư mới:

```typescript
if (receipt && receipt.status === 1) {
  // ... update transaction status ...
  
  // Cập nhật số dư mới sau khi giao dịch thành công
  if (user && balance !== null) {
    const newBalance = Math.max(0, balance - amountNum);
    saveUserBalance(user.address, newBalance); // Lưu vào LocalStorage
    setBalance(newBalance); // Cập nhật state ngay lập tức
    
    // Cập nhật số dư cho người nhận nếu họ trong hệ thống
    const receiver = allUsers.find(
      (u) => u.address.toLowerCase() === toAddress.toLowerCase()
    );
    if (receiver) {
      // ... tính toán và lưu số dư mới cho người nhận ...
    }
  }
}
```

Cập nhật `loadBalance()` để ưu tiên LocalStorage:

```typescript
const loadBalance = async (address: string) => {
  // 1. Ưu tiên: Kiểm tra LocalStorage
  const storedBalance = getStoredBalance(address);
  if (storedBalance !== null) {
    setBalance(storedBalance);
    setIsRealBalance(MOCK_MODE);
    return;
  }

  // 2. Thử lấy từ Blockchain
  // 3. Fallback to file
};
```

### Bước 4-6: Cập nhật các trang khác

- **Statement.tsx**: `loadBalance()` ưu tiên LocalStorage
- **Dashboard.tsx**: `loadBalance()` ưu tiên LocalStorage
- **Withdraw.tsx**: 
  - Tính toán và lưu số dư mới sau khi rút tiền thành công
  - `loadBalance()` ưu tiên LocalStorage

## 📋 Thứ Tự Ưu Tiên Load Số Dư

1. **LocalStorage** (số dư mới nhất sau giao dịch)
2. **Blockchain** (số dư thật từ RPC)
3. **File JSON** (số dư mặc định từ `user_balances.json`)

## 🎯 Kết Quả

- ✅ Số dư được cập nhật ngay sau khi giao dịch thành công
- ✅ Tất cả các trang (Dashboard, Statement, Transfer, Withdraw) hiển thị số dư mới nhất
- ✅ Hoạt động với cả Mock Mode và Real Blockchain
- ✅ Số dư của cả người gửi và người nhận được cập nhật
- ✅ Số dư được lưu vào LocalStorage, không phụ thuộc vào file JSON tĩnh

## 📝 Files Đã Sửa

1. `lib/storage.ts` - Thêm hàm lưu/tải số dư
2. `lib/balances.ts` - Ưu tiên LocalStorage
3. `app/bank/[bankCode]/transfer/Transfer.tsx` - Cập nhật số dư sau chuyển tiền
4. `app/bank/[bankCode]/statement/Statement.tsx` - Load từ LocalStorage
5. `app/bank/[bankCode]/dashboard/Dashboard.tsx` - Load từ LocalStorage
6. `app/bank/[bankCode]/withdraw/Withdraw.tsx` - Cập nhật số dư sau rút tiền

