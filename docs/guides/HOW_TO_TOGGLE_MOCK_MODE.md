# Cách Chuyển Đổi Chế Độ Mock Mode

## 🎯 2 Cách Để Bật/Tắt Mock Mode

### Cách 1: Sử dụng Environment Variable (Khuyến nghị) ⭐

Đây là cách tốt nhất vì không cần sửa code, dễ bật/tắt.

#### Bước 1: Tạo file `.env.local`

Tạo file mới tại: `GUI/web/.env.local`

```bash
# Bật Mock Mode
NEXT_PUBLIC_MOCK_MODE=true

# HOẶC tắt Mock Mode (xóa dòng trên hoặc set = false)
# NEXT_PUBLIC_MOCK_MODE=false
```

#### Bước 2: Restart Next.js Server

Sau khi tạo/sửa file `.env.local`, bạn **PHẢI** restart server:

```bash
# Dừng server (Ctrl + C)
# Sau đó chạy lại:
cd GUI/web
npm run dev
```

**Lưu ý**: Environment variable chỉ được đọc khi server khởi động, nên phải restart!

---

### Cách 2: Sửa Trực Tiếp Trong Code

Mở file: `GUI/web/config/blockchain.ts`

Tìm dòng này (khoảng dòng 20):

```typescript
export const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === 'true' || false;
```

Sửa thành:

```typescript
// BẬT Mock Mode
export const MOCK_MODE = true;

// HOẶC TẮT Mock Mode
// export const MOCK_MODE = false;
```

**Lưu ý**: Sau khi sửa, Next.js sẽ tự động reload (hot reload) nhưng để chắc chắn, nên refresh browser.

---

## 🔍 Kiểm Tra Mock Mode Đã Bật/Tắt?

### Cách 1: Xem trong Browser Console

1. Mở browser (F12 → Console)
2. Thử chuyển tiền với số dư không đủ
3. Xem log:

**Nếu Mock Mode BẬT:**
```
⚠️ CẢNH BÁO: Số dư thực tế trên Blockchain không đủ. 
Đang kích hoạt chế độ GIẢ LẬP (MOCK) để test UI.
```

**Nếu Mock Mode TẮT:**
```
Số dư không đủ. Số dư hiện tại: 0 VND, ...
```

### Cách 2: Xem Source Code (React DevTools)

1. F12 → Sources tab
2. Tìm file `blockchain.ts`
3. Tìm biến `MOCK_MODE` xem giá trị là `true` hay `false`

---

## 📋 Hướng Dẫn Nhanh

### ✅ BẬT Mock Mode:

```bash
# Tạo/sửa file .env.local
echo "NEXT_PUBLIC_MOCK_MODE=true" > GUI/web/.env.local

# Restart server
cd GUI/web
npm run dev
```

### ❌ TẮT Mock Mode:

```bash
# Cách 1: Xóa file .env.local
rm GUI/web/.env.local

# Cách 2: Sửa file .env.local
echo "NEXT_PUBLIC_MOCK_MODE=false" > GUI/web/.env.local

# Cách 3: Sửa config/blockchain.ts
# export const MOCK_MODE = false;

# Sau đó restart server
cd GUI/web
npm run dev
```

---

## 💡 Tips

1. **Development thông thường**: Để `MOCK_MODE = false` (mặc định)
2. **Demo/Presentation**: Bật `MOCK_MODE = true`
3. **Test UI không có blockchain**: Bật `MOCK_MODE = true`

---

## ⚠️ Lưu Ý Quan Trọng

- Mock Mode chỉ dùng cho **test/demo**, không dùng trong production
- Khi Mock Mode bật, giao dịch là **giả lập**, không thực sự chuyển tiền
- Phải **restart server** sau khi thay đổi environment variable
- Số dư có thể hiển thị từ file JSON, không phải blockchain thật

