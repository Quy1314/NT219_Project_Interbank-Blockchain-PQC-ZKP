# 🚀 Hướng Dẫn Nhanh: Chuyển Đổi Mock Mode

## ✅ BẬT Mock Mode (Cho Demo/Test)

```bash
# Bước 1: Tạo file .env.local
cd GUI/web
echo "NEXT_PUBLIC_MOCK_MODE=true" > .env.local

# Bước 2: Restart server (QUAN TRỌNG!)
npm run dev
```

## ❌ TẮT Mock Mode (Chế Độ Thật)

```bash
# Cách 1: Xóa file .env.local
cd GUI/web
rm .env.local

# Hoặc Cách 2: Sửa file .env.local
echo "NEXT_PUBLIC_MOCK_MODE=false" > .env.local

# Bước 2: Restart server
npm run dev
```

## 🔧 Cách 2: Sửa Trực Tiếp Code

Mở file: `GUI/web/config/blockchain.ts`

Tìm dòng này (dòng 15):

```typescript
export const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_MODE === 'true' || false;
```

Thay bằng:

```typescript
// BẬT Mock Mode
export const MOCK_MODE = true;

// HOẶC TẮT Mock Mode  
// export const MOCK_MODE = false;
```

## 🔍 Kiểm Tra Mock Mode Đang Bật Hay Tắt?

Mở Browser Console (F12) và thử chuyển tiền:

- **BẬT**: Thấy log `⚠️ CẢNH BÁO: Số dư thực tế... Đang kích hoạt chế độ GIẢ LẬP`
- **TẮT**: Thấy lỗi `Số dư không đủ...`

