# TLS 1.3 Setup Guide for Interbank Blockchain Network

## Tổng quan

Tài liệu này hướng dẫn thiết lập bảo mật đường truyền TLS 1.3 với AES-GCM-256 cho mạng blockchain liên ngân hàng, theo yêu cầu trong **NT219_BaoCaoTienDo-2.pdf** (Section 6.2).

## Kiến trúc bảo mật

### Thông số kỹ thuật

- **TLS Version**: TLS 1.3 only
- **Cipher Suite**: `TLS_AES_256_GCM_SHA384` (ưu tiên), `TLS_AES_128_GCM_SHA256`
- **Key Exchange**: ECDHE với X25519
- **Certificate Authority**: SBV (Ngân hàng Nhà nước Việt Nam) - Self-signed Root CA
- **Certificate Validity**: 
  - Server certificates: 825 ngày
  - Root CA: 3650 ngày (10 năm)
- **Key Size**: RSA 4096-bit
- **Hash Algorithm**: SHA-384

### Cấu trúc PKI

```
SBV Root CA (Self-signed)
    ├── sbv-server.crt
    ├── vietcombank-server.crt
    ├── vietinbank-server.crt
    ├── bidv-server.crt
    ├── rpcnode-server.crt
    ├── member1besu-server.crt
    ├── member2besu-server.crt
    └── member3besu-server.crt
```

## Hướng dẫn triển khai

### Bước 1: Tạo CA và Certificates

```bash
cd /home/quy/project/NT219_Project/Besu-hyperledger

# Tạo SBV Root CA và certificates cho tất cả nodes
./scripts/generate_tls13_certs.sh
```

Script này sẽ:
1. Tạo SBV Root CA (self-signed)
2. Tạo server certificates cho 8 nodes
3. Tạo PKCS12 keystores và truststores
4. Lưu tất cả vào `config/tls/`

### Bước 2: Tạo cấu hình TLS cho từng node

```bash
# Tạo file config-tls.toml riêng cho từng node
./scripts/generate_node_configs.sh
```

Mỗi node sẽ có file `config/nodes/<node_name>/config-tls.toml` với TLS settings phù hợp.

### Bước 3: Khởi động mạng với TLS

```bash
# Khởi động tất cả nodes với TLS enabled
cd /home/quy/project/NT219_Project/Besu-hyperledger
docker-compose up -d
```

Docker-compose đã được cấu hình để:
- Tự động mount TLS certificates vào containers
- Sử dụng `config-tls.toml` nếu có, ngược lại dùng config thường

### Bước 4: Kiểm tra TLS hoạt động

```bash
# Test TLS 1.3 connection đến rpcnode
openssl s_client -connect localhost:8545 \
    -tls1_3 \
    -CAfile config/tls/ca/certs/sbv-root-ca.crt \
    -showcerts

# Kiểm tra cipher suite đang dùng
echo "Q" | openssl s_client -connect localhost:8545 -tls1_3 2>&1 | grep -E "Cipher|Protocol"
```

Kết quả mong đợi:
```
Protocol  : TLSv1.3
Cipher    : TLS_AES_256_GCM_SHA384
```

## Cấu trúc thư mục

```
Besu-hyperledger/
├── config/
│   ├── tls/                              # TLS certificates
│   │   ├── ca/                           # Root CA
│   │   │   ├── certs/
│   │   │   │   └── sbv-root-ca.crt      # Root CA certificate (public)
│   │   │   ├── private/
│   │   │   │   └── sbv-root-ca.key      # Root CA private key (ENCRYPTED)
│   │   │   └── openssl-ca.cnf           # CA configuration
│   │   │
│   │   ├── sbv/                          # SBV node certificates
│   │   │   ├── sbv-server.key           # Private key
│   │   │   ├── sbv-server.crt           # Server certificate
│   │   │   ├── sbv-server-chain.crt     # Certificate chain
│   │   │   ├── sbv-keystore.p12         # PKCS12 keystore
│   │   │   ├── sbv-truststore.p12       # Truststore
│   │   │   └── password.txt             # Keystore password
│   │   │
│   │   ├── vietcombank/                  # Vietcombank certificates
│   │   ├── vietinbank/                   # Vietinbank certificates
│   │   ├── bidv/                         # BIDV certificates
│   │   ├── rpcnode/                      # RPC node certificates
│   │   ├── member1besu/                  # Member 1 certificates
│   │   ├── member2besu/                  # Member 2 certificates
│   │   ├── member3besu/                  # Member 3 certificates
│   │   │
│   │   ├── README.md                     # TLS documentation
│   │   └── besu-tls-config.toml         # Besu TLS config template
│   │
│   └── nodes/
│       ├── sbv/
│       │   └── config-tls.toml          # Node-specific TLS config
│       ├── vietcombank/
│       │   └── config-tls.toml
│       └── ...
│
└── scripts/
    ├── generate_tls13_certs.sh          # Generate CA & certificates
    └── generate_node_configs.sh         # Generate node configs
```

## Cấu hình Besu

### HTTP JSON-RPC với TLS 1.3

```toml
# HTTP RPC
rpc-http-enabled=true
rpc-http-host="0.0.0.0"
rpc-http-port=8545

# TLS 1.3 Configuration
rpc-http-tls-enabled=true
rpc-http-tls-keystore-file="/config/tls/<NODE_NAME>/<NODE_NAME>-keystore.p12"
rpc-http-tls-keystore-password-file="/config/tls/<NODE_NAME>/password.txt"
rpc-http-tls-client-auth-enabled=false
rpc-http-tls-protocols=["TLSv1.3"]
rpc-http-tls-cipher-suites=["TLS_AES_256_GCM_SHA384","TLS_AES_128_GCM_SHA256"]
```

### WebSocket với TLS 1.3

```toml
# WebSocket
rpc-ws-enabled=true
rpc-ws-host="0.0.0.0"
rpc-ws-port=8546

# TLS 1.3 Configuration
rpc-ws-tls-enabled=true
rpc-ws-tls-keystore-file="/config/tls/<NODE_NAME>/<NODE_NAME>-keystore.p12"
rpc-ws-tls-keystore-password-file="/config/tls/<NODE_NAME>/password.txt"
rpc-ws-tls-client-auth-enabled=false
rpc-ws-tls-protocols=["TLSv1.3"]
rpc-ws-tls-cipher-suites=["TLS_AES_256_GCM_SHA384","TLS_AES_128_GCM_SHA256"]
```

## Kết nối từ Client

### Web3.js với TLS

```javascript
const Web3 = require('web3');
const https = require('https');
const fs = require('fs');

// Đọc Root CA certificate
const ca = fs.readFileSync('config/tls/ca/certs/sbv-root-ca.crt');

// Tạo HTTPS agent với CA
const agent = new https.Agent({
    ca: ca,
    rejectUnauthorized: true
});

// Kết nối với TLS
const web3 = new Web3(new Web3.providers.HttpProvider('https://localhost:8545', {
    agent: agent
}));

// Test connection
web3.eth.getBlockNumber()
    .then(blockNumber => console.log('Current block:', blockNumber))
    .catch(err => console.error('Error:', err));
```

### cURL với TLS

```bash
# GET request với TLS verification
curl --cacert config/tls/ca/certs/sbv-root-ca.crt \
     --tlsv1.3 \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
     https://localhost:8545
```

### Python với TLS

```python
from web3 import Web3
import ssl

# Tạo SSL context với Root CA
ssl_context = ssl.create_default_context(cafile='config/tls/ca/certs/sbv-root-ca.crt')
ssl_context.minimum_version = ssl.TLSVersion.TLSv1_3

# Kết nối
w3 = Web3(Web3.HTTPProvider(
    'https://localhost:8545',
    request_kwargs={'ssl': ssl_context}
))

# Test
print(f"Connected: {w3.is_connected()}")
print(f"Block number: {w3.eth.block_number}")
```

## Kiểm thử và Xác minh

### 1. Kiểm tra Certificate Chain

```bash
# Verify certificate chain
openssl verify -CAfile config/tls/ca/certs/sbv-root-ca.crt \
    config/tls/sbv/sbv-server-chain.crt

# Expected output: OK
```

### 2. Kiểm tra TLS Protocol và Cipher

```bash
# Test TLS 1.3 với AES-GCM-256
echo "Q" | openssl s_client -connect localhost:8545 \
    -tls1_3 \
    -CAfile config/tls/ca/certs/sbv-root-ca.crt 2>&1 | \
    grep -E "Protocol|Cipher|Verify"

# Expected output:
# Protocol  : TLSv1.3
# Cipher    : TLS_AES_256_GCM_SHA384
# Verify return code: 0 (ok)
```

### 3. Kiểm tra từ chối TLS 1.2

```bash
# Thử kết nối với TLS 1.2 (phải bị từ chối)
openssl s_client -connect localhost:8545 -tls1_2 \
    -CAfile config/tls/ca/certs/sbv-root-ca.crt

# Expected: Connection refused hoặc handshake failure
```

### 4. Test với Web3.js

```bash
cd /home/quy/project/NT219_Project/Besu-hyperledger/smart_contracts

# Tạo test script
cat > test-tls.js << 'EOF'
const Web3 = require('web3');
const https = require('https');
const fs = require('fs');

const ca = fs.readFileSync('../config/tls/ca/certs/sbv-root-ca.crt');
const agent = new https.Agent({ ca, rejectUnauthorized: true });

const web3 = new Web3(new Web3.providers.HttpProvider('https://localhost:8545', {
    agent: agent
}));

async function test() {
    try {
        const blockNumber = await web3.eth.getBlockNumber();
        console.log('✓ TLS connection successful!');
        console.log('Current block:', blockNumber);
        
        const accounts = await web3.eth.getAccounts();
        console.log('Accounts:', accounts.length);
    } catch (error) {
        console.error('✗ TLS connection failed:', error.message);
    }
}

test();
EOF

node test-tls.js
```

## Troubleshooting

### Lỗi: "certificate verify failed"

**Nguyên nhân**: Client không tin tưởng SBV Root CA

**Giải pháp**:
```bash
# Import Root CA vào system trust store
sudo cp config/tls/ca/certs/sbv-root-ca.crt /usr/local/share/ca-certificates/sbv-root-ca.crt
sudo update-ca-certificates
```

### Lỗi: "wrong version number"

**Nguyên nhân**: Client đang dùng HTTP thay vì HTTPS

**Giải pháp**: Đổi URL từ `http://` sang `https://`

### Lỗi: "handshake failure"

**Nguyên nhân**: Client không hỗ trợ TLS 1.3 hoặc cipher suite không khớp

**Giải pháp**:
```bash
# Kiểm tra TLS version của client
openssl version

# Cần OpenSSL 1.1.1 trở lên để hỗ trợ TLS 1.3
```

### Besu không khởi động với TLS

**Kiểm tra**:
```bash
# Xem logs
docker logs rpcnode

# Kiểm tra keystore password
cat config/tls/rpcnode/password.txt

# Kiểm tra file permissions
ls -la config/tls/rpcnode/
```

## Bảo mật

### ⚠️ Quan trọng

1. **Root CA Private Key**: File `config/tls/ca/private/sbv-root-ca.key` được mã hóa với password `changeit`. Trong production:
   - Đổi password mạnh hơn
   - Lưu trong HSM (Hardware Security Module)
   - Backup an toàn offline

2. **Keystore Password**: Tất cả keystores dùng password `changeit`. Phải đổi trong production!

3. **File Permissions**:
   ```bash
   chmod 400 config/tls/ca/private/sbv-root-ca.key
   chmod 400 config/tls/*/password.txt
   chmod 400 config/tls/*/*.key
   ```

4. **Certificate Rotation**: Server certificates có hiệu lực 825 ngày. Lên kế hoạch rotation trước khi hết hạn.

### Mutual TLS (mTLS)

Để bật xác thực client certificate (mTLS), cập nhật config:

```toml
rpc-http-tls-client-auth-enabled=true
rpc-ws-tls-client-auth-enabled=true
```

Sau đó client phải cung cấp certificate khi kết nối.

## Compliance với NT219_BaoCaoTienDo-2.pdf

Cấu hình này đáp ứng các yêu cầu:

✅ **Section 6.2 - Deployment Components**:
- Bảo mật kênh truyền: TLS 1.3 ✓
- Mã hóa payload: AES-GCM-256 ✓
- Self-signed CA infrastructure ✓

✅ **Section 4.3 - Quantum Resistance**:
- Sẵn sàng nâng cấp lên PQC (Post-Quantum Cryptography)
- Có thể thay RSA bằng ML-DSA trong tương lai

✅ **Section 7 - Evaluation Plan**:
- E-Crypto: Chữ ký/certificate sai bị từ chối 100% ✓
- E-AuthN: Xác thực TLS certificate ✓

## Tài liệu tham khảo

- [NT219_BaoCaoTienDo-2.pdf](../reference/NT219_BaoCaoTienDo-2.pdf) - Section 6.2
- [Week12_windows_apache_pq_tls_13_openssl_36_guide.md](../reference/Week12_windows_apache_pq_tls_13_openssl_36_guide.md)
- [Hyperledger Besu TLS Documentation](https://besu.hyperledger.org/en/stable/public-networks/how-to/configure/tls/)
- [RFC 8446 - TLS 1.3](https://datatracker.ietf.org/doc/html/rfc8446)

## Liên hệ

- **Sinh viên thực hiện**: 
  - Nguyễn Hoàng Quý - 24521494
  - Huỳnh Nhật Duy - 24520375
- **Giảng viên hướng dẫn**: TS. Nguyễn Ngọc Tự
- **Môn học**: NT219.Q12.ANTT - Mật Mã Học

