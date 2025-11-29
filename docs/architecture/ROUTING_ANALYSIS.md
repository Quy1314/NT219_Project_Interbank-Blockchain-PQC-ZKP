# Phân Tích Vấn Đề Routing Giữa Các Bank

## 🔍 Vấn Đề Hiện Tại

Khi đang ở bank này (ví dụ: `/bank/vcb/dashboard`), nếu click vào bank khác trong Header, phải quay ra trang chủ rồi mới vào được bank khác.

## 📋 Nguyên Nhân

### 1. **Header Link Không Đầy Đủ**
**File**: `components/layout/Header.tsx` (line 38)

```tsx
href={`/bank/${b.code.toLowerCase()}`}
```

**Vấn đề**: Link chỉ trỏ đến `/bank/vcb` (ví dụ), không có `/dashboard` ở cuối.

### 2. **Layout Redirect Logic**
**File**: `app/bank/[bankCode]/layout.tsx` (lines 64-68)

```tsx
// Redirect to dashboard if on base bank path
if (pathname === `/bank/${bankCode}`) {
  router.push(`/bank/${bankCode}/dashboard`);
  return null;
}
```

**Vấn đề**: Logic này chỉ chạy khi `pathname` CHÍNH XÁC là `/bank/${bankCode}`, nhưng có thể có timing issues:
- Khi navigate từ `/bank/vcb/dashboard` → `/bank/vtb`
- Next.js router có thể chưa update `pathname` ngay lập tức
- Layout re-render với bankCode mới nhưng pathname vẫn là cũ
- Redirect không được trigger

### 3. **State Management**
**File**: `app/bank/[bankCode]/layout.tsx` (lines 24-49)

```tsx
useEffect(() => {
  const bankConfig = getBankByCode(bankCode);
  if (!bankConfig) {
    router.push('/');
    return;
  }
  setBank(bankConfig);
  // ... load user
}, [bankCode, router]);
```

**Vấn đề**: 
- State `bank` và `selectedUser` không được reset khi `bankCode` thay đổi
- Có thể có flash của bank cũ trước khi load bank mới
- User state có thể không match với bank mới

### 4. **User Selection Logic**
**File**: `app/bank/[bankCode]/layout.tsx` (lines 34-40)

```tsx
const savedUserId = getSelectedUser();
if (savedUserId) {
  const user = bankConfig.users.find((u) => u.id === savedUserId);
  if (user) {
    setSelectedUserState(user);
    return; // ⚠️ Problem: user từ bank cũ có thể không tồn tại trong bank mới
  }
}
```

**Vấn đề**: 
- Nếu `savedUserId` là user từ bank cũ (ví dụ: `vietcombank_user1`)
- Bank mới (VietinBank) không có user này
- Logic sẽ fallback về user đầu tiên nhưng có delay

## ✅ Giải Pháp

### 1. Sửa Header Link
Link trực tiếp đến `/dashboard` thay vì chỉ `/bank/{code}`:

```tsx
href={`/bank/${b.code.toLowerCase()}/dashboard`}
```

### 2. Cải Thiện Layout Redirect
Thêm logic xử lý tốt hơn khi bankCode thay đổi:

```tsx
// Clear state khi bankCode thay đổi
useEffect(() => {
  setBank(null);
  setSelectedUserState(null);
}, [bankCode]);
```

### 3. Reset User State
Khi chuyển bank, reset user state và load user của bank mới:

```tsx
// Load bank config
const bankConfig = getBankByCode(bankCode);
if (!bankConfig) {
  router.push('/');
  return;
}

// Clear old user if switching banks
const currentBank = getSelectedBank();
if (currentBank && currentBank !== bankCode) {
  // Reset user selection when switching banks
  setSelectedUser(null);
}
```

### 4. Cải Thiện Navigation
Sử dụng router.push với shallow routing hoặc đảm bảo state được reset đúng cách.

## 🔧 File Cần Sửa

1. **`components/layout/Header.tsx`** - Sửa link đến `/dashboard`
2. **`app/bank/[bankCode]/layout.tsx`** - Cải thiện state management khi switch bank

