# Chế Độ Mock Mode - Hướng Dẫn Sử Dụng

## 📋 Tổng Quan

Mock Mode là một tính năng cho phép test/demo giao diện mà không cần blockchain thật có tiền. Khi bật Mock Mode, hệ thống sẽ **giả lập** các giao dịch thành công ngay cả khi số dư blockchain thực tế là 0.

## ⚠️ CẢNH BÁO

- **Mock Mode chỉ dùng cho development/demo**, KHÔNG dùng trong production
- Các giao dịch trong Mock Mode là **giả lập**, không thực sự chuyển tiền trên blockchain
- Số dư hiển thị có thể từ file JSON, không phải blockchain thật

## 🔧 Cách Bật Mock Mode

### Cách 1: Sử dụng Environment Variable (Khuyến nghị)

Tạo file `.env.local` trong thư mục `GUI/web/`:

```bash
NEXT_PUBLIC_MOCK_MODE=true
```

Sau đó restart Next.js dev server:

```bash
npm run dev
```

### Cách 2: Sửa trực tiếp trong code

Mở file `GUI/web/config/blockchain.ts` và đổi:

```typescript
export const MOCK_MODE = true; // Đổi từ false thành true
```

## 🎯 Khi Nào Sử Dụng Mock Mode?

1. **Demo/Presentation**: Khi cần demo giao diện cho khách hàng/giảng viên
2. **UI Testing**: Test các tính năng UI mà không cần blockchain có tiền
3. **Development**: Phát triển tính năng mới khi blockchain chưa sẵn sàng
4. **Bài tập**: Làm bài tập/báo cáo khi không có điều kiện setup blockchain đầy đủ

## 🔄 Cách Hoạt Động

### Khi Mock Mode = true:

1. **Hiển thị số dư**: 
   - Ưu tiên blockchain (nếu kết nối được)
   - Fallback về file JSON (nếu blockchain lỗi)

2. **Giao dịch**:
   - Cho phép giao dịch ngay cả khi số dư từ file (ảo)
   - Khi gửi lệnh và blockchain báo "không đủ tiền", hệ thống sẽ:
     - Tạo một mock transaction hash
     - Trả về receipt giả với status = success
     - Hiển thị thành công trên UI

3. **Lịch sử**:
   - Giao dịch mock vẫn được lưu vào localStorage
   - Hiển thị như giao dịch thật trong lịch sử

### Khi Mock Mode = false (Mặc định):

1. **Hiển thị số dư**:
   - Chỉ lấy từ blockchain
   - Nếu blockchain lỗi, hiển thị "(Ngoại tuyến)"

2. **Giao dịch**:
   - **CHẶN** giao dịch nếu số dư từ file (ảo)
   - Yêu cầu kết nối blockchain và có số dư thật

## 📝 Ví Dụ Sử Dụng

### Scenario 1: Demo cho khách hàng

```bash
# 1. Bật Mock Mode
echo "NEXT_PUBLIC_MOCK_MODE=true" > GUI/web/.env.local

# 2. Start server
cd GUI/web && npm run dev

# 3. Mở browser và demo
# - Số dư hiển thị từ file (100 triệu)
# - Có thể chuyển tiền bình thường
# - Giao dịch "thành công" ngay cả khi blockchain không có tiền
```

### Scenario 2: Test UI không có blockchain

```bash
# 1. Bật Mock Mode
export NEXT_PUBLIC_MOCK_MODE=true

# 2. Không cần start blockchain, chỉ cần GUI
cd GUI/web && npm run dev

# 3. Test các tính năng:
# - Chuyển tiền
# - Rút tiền  
# - Xem lịch sử
# - Tạo sao kê
```

## 🚨 Lưu Ý

1. **Mock transactions không thực sự chuyển tiền**: Tất cả chỉ là giả lập
2. **Không dùng cho production**: Mock Mode chỉ để development/demo
3. **Số dư hiển thị có thể sai**: Nếu từ file JSON, có thể không khớp với blockchain
4. **Transaction hash là fake**: Hash dạng `0xMOCK_TX_HASH_...`

## 🔍 Kiểm Tra Mock Mode Có Đang Bật?

Mở browser console (F12) và xem log khi giao dịch:

```
⚠️ CẢNH BÁO: Số dư thực tế trên Blockchain không đủ. 
Đang kích hoạt chế độ GIẢ LẬP (MOCK) để test UI.
```

## 🔄 Tắt Mock Mode

### Cách 1: Xóa environment variable

```bash
rm GUI/web/.env.local
# Hoặc set MOCK_MODE=false
```

### Cách 2: Sửa code

Trong `config/blockchain.ts`:

```typescript
export const MOCK_MODE = false; // Tắt mock mode
```

## 📚 Files Liên Quan

- `config/blockchain.ts` - Cấu hình MOCK_MODE
- `lib/blockchain.ts` - Logic mock transaction
- `app/bank/[bankCode]/transfer/Transfer.tsx` - UI transfer với mock support
- `app/bank/[bankCode]/withdraw/Withdraw.tsx` - UI withdraw với mock support

## 💡 Tips

1. **Development**: Luôn để `MOCK_MODE = false` khi develop để phát hiện lỗi sớm
2. **Demo**: Bật `MOCK_MODE = true` chỉ khi demo
3. **Testing**: Có thể dùng Mock Mode để test edge cases mà không cần blockchain

