# Sửa Lỗi Kết Nối Blockchain - Hướng Dẫn

## 🔍 Vấn Đề

Thông báo: **"Không thể kết nối đến blockchain. Đang sử dụng số dư từ file."**

### Nguyên Nhân

1. **Config sai port**: GUI đang trỏ đến port `8545` nhưng không có service nào đang listen ở port đó
2. **Container rpcnode không chạy**: Container `rpcnode` được cấu hình để expose port 8545 nhưng không đang chạy
3. **Blockchain đang chạy ở port khác**: Container `sbv` đang chạy và expose port `21001`

## ✅ Giải Pháp

### Cách 1: Sửa Config Trỏ Đến Port Đang Hoạt Động (Khuyến nghị)

File `GUI/web/config/blockchain.ts` đã được cập nhật để:
- Mặc định trỏ đến port `21001` (sbv container đang chạy)
- Có thể override bằng environment variable `NEXT_PUBLIC_RPC_ENDPOINT`

### Cách 2: Khởi Động Container rpcnode

Nếu muốn dùng port 8545 (theo thiết kế ban đầu):

```bash
cd Besu-hyperledger
docker compose up -d rpcnode
```

Kiểm tra xem container đã chạy:

```bash
docker ps --filter "name=rpcnode"
```

### Cách 3: Sử Dụng Environment Variable

Tạo file `.env.local` trong thư mục `GUI/web/`:

```bash
# Nếu rpcnode đang chạy ở port 8545
NEXT_PUBLIC_RPC_ENDPOINT=http://localhost:8545

# Hoặc nếu dùng sbv container ở port 21001
NEXT_PUBLIC_RPC_ENDPOINT=http://localhost:21001
```

## 🔧 Kiểm Tra Kết Nối

### 1. Kiểm tra containers đang chạy:

```bash
docker ps --filter "name=besu" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### 2. Test kết nối RPC:

```bash
# Test port 21001 (sbv container)
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://localhost:21001

# Test port 8545 (rpcnode container - nếu đang chạy)
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://localhost:8545
```

### 3. Kiểm tra trong Browser Console:

Mở Developer Tools (F12) và chạy:

```javascript
fetch('http://localhost:21001', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'eth_blockNumber',
    params: [],
    id: 1
  })
}).then(r => r.json()).then(console.log)
```

## 📋 Port Mapping

Từ `docker-compose.yml`:

| Container | Internal Port | External Port | Status |
|-----------|--------------|---------------|--------|
| `sbv` | 8545 | 21001 | ✅ Đang chạy |
| `rpcnode` | 8545 | 8545 | ❌ Không chạy |

## 🎯 Sau Khi Sửa

1. **Restart Next.js dev server**:

```bash
cd GUI/web
npm run dev
```

2. **Refresh browser** và kiểm tra lại

3. **Kiểm tra log** trong Browser Console:
   - Không còn thông báo "Không thể kết nối đến blockchain"
   - Balance được load từ blockchain (thay vì file)

## ⚠️ Lưu Ý

- Nếu blockchain chưa sync xong, số dư có thể là 0
- Với Mock Mode bật (`MOCK_MODE = true`), app vẫn hoạt động được dù không kết nối blockchain
- Nếu cần kết nối blockchain thật, tắt Mock Mode và đảm bảo blockchain đang chạy

