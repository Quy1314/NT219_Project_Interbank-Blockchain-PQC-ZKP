# 🚀 Runbook - Hướng dẫn chạy hệ thống từ đầu

Runbook này hướng dẫn chi tiết cách khởi động hệ thống từ đầu: từ blockchain, deploy contract, đến chạy web dev.

## 🎯 Quick Decision Guide

**Bạn muốn:**
- 🔐 **Full security (TLS 1.3 + PQC)?** → Follow [Quick Start Full Security](#-quick-start-với-tls-13--pqc-full-security---khuyên-dùng)
- ⚡ **Simple & fast?** → Follow [Quick Start Simple](#quick-start-không-tlspqc-đơn-giản-nhất)
- 🧪 **Only PQC testing?** → Follow [Quick Start PQC only](#quick-start-với-pqc-không-tls)

**💡 Important:** Khi TLS enabled, node **CHỈ** accept **HTTPS** (`https://localhost:21001`), không accept HTTP!

## 📋 Mục lục

1. [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
2. [Bước 0A: Thiết lập TLS 1.3 (Khuyên dùng)](#bước-0a-thiết-lập-tls-13-khuyên-dùng)
3. [Bước 0B: Thiết lập PQC/KSM (Post-Quantum Crypto)](#bước-0b-thiết-lập-pqcksm-post-quantum-crypto)
4. [Bước 1: Khởi động Blockchain](#bước-1-khởi-động-blockchain)
5. [Bước 2: Kiểm tra Blockchain](#bước-2-kiểm-tra-blockchain)
6. [Bước 3: Deploy Smart Contracts](#bước-3-deploy-smart-contracts) **⭐ CẬP NHẬT**
   - [3.1-3.5: Deploy InterbankTransfer](#bước-3-deploy-smart-contracts)
   - [3.6: Deploy lại Contract (nếu có thay đổi)](#35-deploy-lại-contract-nếu-có-thay-đổi) **⭐ MỚI**
   - [3.7: Deploy PKI Registry](#bước-37-deploy-pki-registry-user-management) **⭐ MỚI**
   - [3.8: Link PKI to InterbankTransfer](#bước-38-link-pki-to-interbanktransfer) **⭐ MỚI**
7. [Bước 4: Khởi động Web GUI](#bước-4-khởi-động-web-gui)
8. [Bước 5: Sử dụng Dashboard (All-in-One)](#bước-5-sử-dụng-dashboard-all-in-one) **⭐ CẬP NHẬT**
9. [Troubleshooting](#troubleshooting)
10. [Quick Start (Tóm tắt nhanh)](#quick-start-tóm-tắt-nhanh)
11. [TLS Commands Cheat Sheet](#tls-commands-cheat-sheet)

---

## Yêu cầu hệ thống

### Phần mềm cần thiết:
- **Docker** và **Docker Compose** (để chạy blockchain network)
- **Node.js 18+** (để chạy scripts và web GUI)
- **npm** hoặc **yarn** (package manager)

### Kiểm tra:
```bash
docker --version          # Docker 20.10+
docker-compose --version  # Docker Compose 2.0+
node --version            # Node.js 18.0+
npm --version             # npm 8.0+
```

---

## Bước 0A: Thiết lập TLS 1.3 (Khuyên dùng)

> **Lưu ý:** Bước này là tùy chọn nhưng **rất khuyến khích** để bảo mật đường truyền theo yêu cầu NT219_BaoCaoTienDo-2.pdf.

### 0.1. Tạo TLS Certificates

```bash
cd Besu-hyperledger

# Tạo SBV Root CA và certificates cho tất cả nodes
./scripts/generate_tls13_certs.sh
```

**Script này sẽ:**
- Tạo SBV Root CA (Self-signed) với RSA 4096-bit
- Tạo server certificates cho 8 nodes với TLS 1.3
- Tạo PKCS12 keystores và truststores
- Lưu tất cả vào `config/tls/`

**Thời gian:** Khoảng 30 giây

### 0.2. Tạo Node Configurations với TLS

```bash
# Tạo file config-tls.toml riêng cho từng node
./scripts/generate_node_configs.sh
```

### 0.3. Kiểm tra TLS đã được tạo

```bash
# Kiểm tra Root CA
ls -lh config/tls/ca/certs/sbv-root-ca.crt

# Kiểm tra certificates của các nodes
ls -lh config/tls/*/
```

Bạn sẽ thấy mỗi node có:
- `<node>-server.key` - Private key
- `<node>-server.crt` - Server certificate
- `<node>-keystore.p12` - PKCS12 keystore
- `<node>-truststore.p12` - Truststore
- `password.txt` - Keystore password

### 0.4. Cấu hình TLS

**Thông số kỹ thuật:**
- **TLS Version:** TLS 1.3 only
- **Cipher Suite:** TLS_AES_256_GCM_SHA384 (primary)
- **Key Size:** RSA 4096-bit
- **Hash:** SHA-384

Docker-compose đã được cấu hình tự động:
- TLS certificates được mount vào containers
- Besu tự động sử dụng `config-tls.toml` nếu có

**Chi tiết:** Xem [TLS13_SETUP_GUIDE.md](../deployment/TLS13_SETUP_GUIDE.md)

---

## Bước 0B: Thiết lập PQC/KSM (Post-Quantum Crypto)

> **Lưu ý:** Bước này là **tùy chọn** nhưng rất khuyến khích để đạt quantum resistance theo yêu cầu NT219_BaoCaoTienDo-2.pdf (Track A - Section 5.1).

### Giới thiệu PQC/KSM

**KSM (Key Simulation Module)** là service Java cung cấp:
- Chữ ký số hậu lượng tử (Dilithium)
- Mã hóa KEM hậu lượng tử (Kyber)
- REST API để GUI và blockchain gọi

**Kiến trúc:**
```
GUI (Next.js) → Bridge Layer (TypeScript) → KSM Service (Java/Spring Boot) → Blockchain
```

### 0B.1. Build và Khởi động KSM Service

**Build KSM Service (lần đầu tiên hoặc khi có thay đổi code):**

```bash
cd Besu-hyperledger
docker-compose build ksm
```

**Thời gian build:** ~10-15 giây (Maven dependencies đã cached)

**Khởi động KSM Service:**

```bash
docker-compose up -d ksm
```

**Kiểm tra KSM đã sẵn sàng:**

```bash
# Check health (with storage info)
curl http://localhost:8080/ksm/health | python3 -m json.tool

# Expected response:
{
  "status": "UP",
  "service": "KSM - Key Simulation Module",
  "version": "1.0.0",
  "storageEnabled": true,
  "algorithms": ["DILITHIUM2", "DILITHIUM3", "DILITHIUM5", "KYBER512", "KYBER768", "KYBER1024"],
  "defaultSignature": "DILITHIUM3",
  "defaultEncryption": "KYBER768"
}
```

**Kiểm tra logs:**

```bash
docker logs ksm-service --tail 20

# Expected output:
[KSM] Storage initialized at: /app/ksm-data
[KSM] New master key generated and saved
[WARNING] Master key file created at: /app/ksm-data/master.key
[WARNING] BACKUP this file! If lost, all keys cannot be decrypted!
[KSM] Loaded 0 key pairs from storage
[PQCProcessService] Loaded 0 keys from storage
Started KSMApplication in X seconds
```

**⚠️ Important: Persistent Storage**

KSM sử dụng **persistent storage** để lưu private keys:
- **Master Key:** `./ksm-data/master.key` (AES-256 encryption key)
- **Keys:** `./ksm-data/keys/*.properties` (encrypted key pairs)

**🔒 Backup Master Key:**
```bash
# CRITICAL: Backup master key ngay!
cp ./ksm-data/master.key ./backup/master-$(date +%Y%m%d).key

# If master key is lost, all stored keys cannot be decrypted!
```

### 0B.2. Generate PQC Keys cho Banks

Tạo khóa PQC cho các ngân hàng:

```bash
# Generate key cho Vietcombank
curl -X POST http://localhost:8080/ksm/generateKey \
  -H "Content-Type: application/json" \
  -d '{"entityId":"vietcombank"}'

# Generate key cho Vietinbank
curl -X POST http://localhost:8080/ksm/generateKey \
  -H "Content-Type: application/json" \
  -d '{"entityId":"vietinbank"}'

# Generate key cho BIDV
curl -X POST http://localhost:8080/ksm/generateKey \
  -H "Content-Type: application/json" \
  -d '{"entityId":"bidv"}'
```

**Response mẫu:**
```json
{
  "success": true,
  "entityId": "vietcombank",
  "publicKey": "base64_encoded_public_key...",
  "algorithm": "Dilithium3",
  "publicKeySize": 1952,
  "message": "Key pair generated successfully"
}
```

**✅ Keys Automatically Saved:**
- Private keys **encrypted with AES-256-CBC**
- Saved to: `./ksm-data/keys/vietcombank.properties`
- Keys **persist across KSM restarts**

**Verify keys stored:**
```bash
# List all stored entities
curl http://localhost:8080/ksm/entities | python3 -m json.tool

# Expected:
{
  "success": true,
  "entities": ["vietcombank", "vietinbank", "bidv"],
  "count": 3
}
```

### 0B.3. Test PQC Signing

```bash
# Sign a transaction
curl -X POST http://localhost:8080/ksm/sign \
  -H "Content-Type: application/json" \
  -d '{
    "entityId": "vietcombank",
    "message": "Transfer 1000000 VND to vietinbank"
  }' | python3 -m json.tool

# Response:
{
  "success": true,
  "signature": "base64_encoded_signature...",
  "algorithm": "Dilithium3",
  "signatureSize": 3309,
  "timestamp": 1702345678901
}
```

### 0B.4. KSM Storage Management

**Get storage statistics:**
```bash
curl http://localhost:8080/ksm/storage/stats | python3 -m json.tool
```

**Response:**
```json
{
  "success": true,
  "storageDir": "/app/ksm-data",
  "totalEntities": 3,
  "masterKeyExists": true,
  "totalStorageSize": 24597,
  "cachedKeys": 3
}
```

**List all stored keys:**
```bash
curl http://localhost:8080/ksm/entities | python3 -m json.tool
```

**Delete a key (if needed):**
```bash
curl -X DELETE http://localhost:8080/ksm/deleteKey/test_entity | python3 -m json.tool
```

**Test persistence (keys survive restart):**
```bash
# 1. Generate a test key
curl -X POST http://localhost:8080/ksm/generateKey \
  -H "Content-Type: application/json" \
  -d '{"entityId":"test_persistence"}'

# 2. Restart KSM
docker-compose restart ksm && sleep 5

# 3. Check entities (should still be there!)
curl http://localhost:8080/ksm/entities
# → ["vietcombank", "vietinbank", "bidv", "test_persistence"]  ✅ Persisted!
```

**⚠️ Security: Backup Master Key**
```bash
# CRITICAL: Backup master key regularly!
cp ./ksm-data/master.key ./backup/master-$(date +%Y%m%d).key

# If master key is lost, all encrypted private keys cannot be decrypted!
```

**Kiểm tra logs:**
```bash
docker logs ksm-service --tail 20

# Expected output:
[KSM] Storage initialized at: /app/ksm-data
[KSM] Master key loaded from file
[KSM] Loaded 3 key pairs from storage
[PQCProcessService] Loaded 3 keys from storage
[KSM] Controller initialized with PQC Process Service
```

### 0B.5. PQC trong GUI - ✅ Enabled by Default

**🔒 PQC được BẬT MẶC ĐỊNH trong GUI** (từ Dec 2025)

Tất cả transactions sẽ tự động sử dụng chữ ký PQC (Dilithium3) nếu KSM service available.

**Không cần configuration gì cả!** PQC tự động hoạt động khi:
1. ✅ KSM service đang chạy (`docker-compose up -d ksm`)
2. ✅ Keys đã được generate cho banks
3. ✅ GUI detect được KSM health endpoint

**Kiểm tra PQC status trong browser console (F12):**

```javascript
// Check PQC enabled (should be true by default)
localStorage.getItem('pqc_enabled'); // null or 'true' = enabled

// Or use config
import { getPQCEnabled } from '@/config/pqc';
console.log('PQC Enabled:', getPQCEnabled()); // true
```

**Disable PQC (chỉ khi cần test):**

```bash
# Option 1: Environment variable (tạo .env.local)
echo "NEXT_PUBLIC_PQC_ENABLED=false" > GUI/web/.env.local

# Option 2: Browser console
# localStorage.setItem('pqc_enabled', 'false'); location.reload();
```

**Sử dụng PQC trong transaction (tự động):**

```typescript
import { usePQC } from '@/lib/usePQC';

const { signTransaction, isKSMReady } = usePQC();

// PQC tự động được dùng nếu KSM ready
if (isKSMReady) {
  // Automatically signs with Dilithium3
  const signature = await signTransaction(
    'vietcombank', 
    'vietinbank', 
    1000000, 
    'Transfer'
  );
  
  console.log('🔐 Signed with PQC:', signature.signature);
}
```

**Configuration file:** `GUI/web/config/pqc.ts`
```typescript
export const PQC_ENABLED_DEFAULT = true; // ✅ ENABLED
export const DEFAULT_SIGNATURE_ALGORITHM = 'Dilithium3';
export const KSM_SERVICE_URL = 'http://localhost:8080';
```

**Chi tiết:** Xem [PQC_CONFIGURATION.md](../../GUI/web/PQC_CONFIGURATION.md)

### 0B.6. Performance

**PQC Operations (Dilithium3):**

---

### 0B.6. Performance

**PQC Operations (Dilithium3):**
- Key generation: ~1ms
- Signing: ~2ms  
- Verification: ~1ms
- Signature size: ~3.3KB

**Impact:**
- TPS giảm 10-20% (vẫn đạt 80-90 TPS)
- Latency tăng 22-72ms per transaction
- **Acceptable** cho use case liên ngân hàng

### 0B.7. Lưu ý quan trọng

⚠️ **Implementation hiện tại:**
- Code PQC là **simulation/mock** để minh họa flow
- Trong production, thay bằng thư viện thực (BouncyCastle, OQS)
- Private keys cần lưu trong HSM, không lưu trong memory

✅ **Để sau này nâng cấp lên PQC thật:**
1. Thay implementation trong `DilithiumService.java` và `KyberService.java`
2. Dùng BouncyCastle PQC library
3. Hoặc dùng Open Quantum Safe (liboqs)
4. Không cần thay đổi API hoặc GUI code

🔒 **PQC Status:**
- ✅ **GUI:** PQC enabled by default (Dec 2025)
- ✅ **KSM Service:** Hoàn thiện với 6 REST endpoints
- ✅ **Bridge Layer:** TypeScript client ready
- ⏳ **Verifier Contract:** Sẽ được triển khai bởi ZKP module sau
- ⏳ **Real PQC Library:** Chưa integrate (dùng mock)

**Chi tiết cấu hình:** [PQC_CONFIGURATION.md](../../GUI/web/PQC_CONFIGURATION.md) | [PQC_DEFAULT_ENABLED.md](../../PQC_DEFAULT_ENABLED.md)

---

## Bước 1: Khởi động Blockchain

### 1.1. Di chuyển đến thư mục blockchain

```bash
cd Besu-hyperledger
```

### 1.2. Khởi động blockchain network

Chạy script `run.sh` để khởi động tất cả các containers:

```bash
./run.sh
```

**Script này sẽ:**
- Tạo các thư mục logs cần thiết
- Build và chạy tất cả Docker containers (Besu nodes, RPC node, monitoring tools)
- Tự động kích hoạt TLS 1.3 nếu certificates đã được tạo
- Hiển thị danh sách services và endpoints

**Thời gian chờ:** Khoảng 1-2 phút để tất cả containers khởi động.

**Lưu ý:** Nếu đã setup TLS (Bước 0), blockchain sẽ tự động chạy với HTTPS trên port 8545 và 21001-21004.

### 1.3. Kiểm tra containers đang chạy

```bash
docker ps
```

Bạn sẽ thấy các containers:
- `besu-hyperledger-sbv-1` - SBV node (port 21001)
- `besu-hyperledger-vietcombank-1` - Vietcombank node (port 21002)
- `besu-hyperledger-vietinbank-1` - Vietinbank node (port 21003)
- `besu-hyperledger-bidv-1` - BIDV node (port 21004)
- `besu-hyperledger-member1besu-1`, `member2besu-1`, `member3besu-1` - Member nodes
- `besu-hyperledger-prometheus-1` - Prometheus monitoring
- `besu-hyperledger-grafana-1` - Grafana dashboard (port 3001)

---

## Bước 2: Kiểm tra Blockchain

### 2.1. Kiểm tra blockchain đã sẵn sàng

Kiểm tra RPC endpoint có phản hồi không:

#### Nếu đã bật TLS (Khuyên dùng):

```bash
# Option 1: Với CA certificate (secure)
curl --cacert config/tls/ca/certs/sbv-root-ca.crt \
  --tlsv1.3 \
  -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Option 2: Insecure mode (nhanh cho testing)
curl -k --tlsv1.3 \
  -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

**Lưu ý:** Khi TLS enabled, node **CHỈ** accept HTTPS. HTTP sẽ bị lỗi "Empty reply from server".

#### Nếu chưa bật TLS:

```bash
curl -X POST http://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

**Kết quả mong đợi:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x..."
}
```

Nếu nhận được response, blockchain đã sẵn sàng! ✅

#### Kiểm tra TLS hoạt động:

```bash
cd Besu-hyperledger
./scripts/test_tls.sh
```

Nếu tất cả tests pass, TLS đã được cấu hình đúng! 🔐

### 2.2. Kiểm tra block số hiện tại

#### Với TLS:
```bash
curl --cacert config/tls/ca/certs/sbv-root-ca.crt \
  --tlsv1.3 \
  -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  | python3 -c "import sys, json; print('Block number:', int(json.load(sys.stdin)['result'], 16))"
```

#### Không TLS:
```bash
curl -X POST http://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  | python3 -c "import sys, json; print('Block number:', int(json.load(sys.stdin)['result'], 16))"
```

### 2.3. Kiểm tra consensus đang hoạt động

Kiểm tra validators:

**Với TLS:**
```bash
curl --cacert config/tls/ca/certs/sbv-root-ca.crt --tlsv1.3 \
  -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"qbft_getValidatorsByBlockNumber","params":["latest"],"id":1}' \
  | python3 -m json.tool

# Hoặc insecure mode
curl -k --tlsv1.3 \
  -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"qbft_getValidatorsByBlockNumber","params":["latest"],"id":1}' \
  | python3 -m json.tool
```

**Không TLS:**
```bash
curl -X POST http://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"qbft_getValidatorsByBlockNumber","params":["latest"],"id":1}' \
  | python3 -m json.tool
```

**Kết quả mong đợi:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": [
    "0x27a97c9aaf04f18f3014c32e036dd0ac76da5f18",
    "0x93917cadbace5dfce132b991732c6cda9bcc5b8a",
    "0x98c1334496614aed49d2e81526d089f7264fed9c",
    "0xce412f988377e31f4d0ff12d74df73b51c42d0ca"
  ]
}
```

Bạn sẽ thấy danh sách 4 validators.

---

## Bước 3: Deploy Smart Contracts

> **⚠️ Quan trọng:** Thứ tự deploy đúng là: InterbankTransfer → PKI Registry → Link PKI

### 3.1. Di chuyển đến thư mục smart contracts

```bash
cd smart_contracts
```

### 3.2. Cài đặt dependencies (nếu chưa có)

```bash
npm install --legacy-peer-deps
```

### 3.3. Compile Smart Contract

**Path đúng:** `scripts/compile.js` (KHÔNG phải `scripts/public/compile.js`)

```bash
node scripts/compile.js
```

**Kết quả mong đợi:**
```
✅ Contracts compiled successfully
- Counter.json (117KB)
- InterbankTransfer.json (1.8MB)
- SimpleStorage.json (199KB)
```

Hoặc nếu có Hardhat:

```bash
npx hardhat compile
```

### 3.4. Deploy và Initialize Contract

Có 2 cách:

#### Cách 1: Sử dụng script tự động (Khuyên dùng)

Script này sẽ deploy contract và init số dư cho tất cả users:

**Nếu blockchain chạy với TLS (HTTPS):**

```bash
# Workaround cho Node.js 22 với self-signed certificates
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/public/deploy_and_init.js
unset NODE_TLS_REJECT_UNAUTHORIZED
```

**Nếu blockchain chạy không TLS (HTTP):**

```bash
node scripts/public/deploy_and_init.js
# Hoặc explicit set endpoint
RPC_ENDPOINT=http://localhost:21001 node scripts/public/deploy_and_init.js
```

**💡 Lưu ý về TLS:**
- Blockchain với TLS chỉ accept HTTPS connections
- Node.js 22 có issue với self-signed certificates qua fetch API
- Workaround: Set `NODE_TLS_REJECT_UNAUTHORIZED=0` (chỉ dùng development!)
- Chi tiết: `smart_contracts/DEPLOY_WITH_TLS.md`

**Script này sẽ:**
1. Deploy `InterbankTransfer` contract lên blockchain (với withdraw function)
2. Authorize tất cả bank addresses
3. Deposit 100 ETH cho mỗi user vào contract
4. Tự động cập nhật contract address trong GUI config

**⭐ Lưu ý về Withdraw Function:**
- Contract đã có `withdraw()` function để rút tiền từ contract balance
- Khi rút tiền, số dư sẽ được trừ từ contract balance (không phải native ETH)
- Withdraw function yêu cầu KYC verification nếu PKI enabled
- Để sử dụng withdraw, cần deploy lại contract sau khi thêm function mới

**Kết quả mong đợi:**
```
🚀 Bắt đầu deploy contract và khởi tạo...

============================================================
BƯỚC 1: DEPLOY CONTRACT
============================================================
✅ Contract deployed at: 0x...
✅ Contract address saved to: InterbankTransfer.address.txt

============================================================
BƯỚC 2: KHỞI TẠO CONTRACT (Authorize + Deposit)
============================================================
Connecting to blockchain at: https://localhost:21001
✅ Connected to network: Chain ID 1337
📋 Using Contract Address: 0x...
Owner address: 0x...
Contract owner: 0x...
PKI Enabled: false

📋 Bước 1: Authorize bank addresses...
  ✅ Authorized 0x... (VCB)
  ✅ Authorized 0x... (VTB)
  ...

📋 Bước 2: Deposit initial balance for all users...
  ✅ Depositing 100.0 ETH to 0x... (VCB)
  ✅ Deposit successful! New balance: 100.0 ETH
  ✅ Depositing 100.0 ETH to 0x... (VTB)
  ...

✅ Initialization completed!
   Success: 6/6
   Failed: 0/6

📊 Final balances:
   0x... (VCB): 100.0 ETH
   0x... (VTB): 100.0 ETH
   ...

============================================================
BƯỚC 3: CẬP NHẬT GUI CONFIG
============================================================
✅ GUI Config đã được cập nhật

✅ HOÀN TẤT! Contract đã được deploy và khởi tạo thành công!
```

#### Cách 2: Deploy và Init riêng biệt

Nếu muốn deploy và init riêng:

**Với TLS:**
```bash
# Deploy contract
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/public/deploy_interbank.js

# Script tự động lưu contract address vào InterbankTransfer.address.txt
# Initialize contract (authorize + deposit)
# Script sẽ tự động đọc address từ file hoặc env var CONTRACT_ADDRESS
RPC_ENDPOINT=https://localhost:21001 node scripts/public/init_contract.js

# Hoặc set explicit address:
export CONTRACT_ADDRESS=0x...
RPC_ENDPOINT=https://localhost:21001 node scripts/public/init_contract.js

# Cleanup
unset NODE_TLS_REJECT_UNAUTHORIZED
```

**Không TLS:**
```bash
# Deploy contract
node scripts/public/deploy_interbank.js

# Initialize contract
# Script tự động đọc address từ InterbankTransfer.address.txt
node scripts/public/init_contract.js

# Hoặc set explicit address:
export CONTRACT_ADDRESS=0x...
node scripts/public/init_contract.js

# Hoặc deposit cho user cụ thể
node scripts/public/deposit_user.js
```

**💡 Lưu ý về `init_contract.js`:**
- Script tự động đọc contract address từ:
  1. Environment variable `CONTRACT_ADDRESS` (ưu tiên cao nhất)
  2. File `contracts/InterbankTransfer.address.txt` (nếu env var không có)
  3. Fallback address cũ (backward compatibility)
- Script tự động hỗ trợ HTTPS khi dùng `https://` endpoint
- Script kiểm tra PKI enabled status và hiển thị warning nếu cần
- Script hiển thị contract address đang sử dụng để debug

### 3.5. Deploy lại Contract (nếu có thay đổi)

> **⚠️ QUAN TRỌNG:** Nếu contract code đã thay đổi (ví dụ: thêm withdraw function), cần **deploy lại** contract.

**Khi nào cần deploy lại:**
- ✅ Thêm function mới (ví dụ: `withdraw()`)
- ✅ Sửa logic trong contract
- ✅ Thay đổi struct hoặc mapping

**Cách deploy lại:**

```bash
cd Besu-hyperledger/smart_contracts

# 1. Compile lại contract
node scripts/compile.js

# 2. Deploy lại (với TLS)
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/public/deploy_and_init.js
unset NODE_TLS_REJECT_UNAUTHORIZED

# Hoặc không TLS
RPC_ENDPOINT=http://localhost:21001 node scripts/public/deploy_and_init.js
```

**Lưu ý:**
- ⚠️ Deploy lại sẽ tạo contract address MỚI
- ⚠️ Số dư cũ sẽ KHÔNG được chuyển sang contract mới
- ⚠️ Cần chạy `init_contract.js` lại để authorize và deposit cho users
- ✅ Script `deploy_and_init.js` tự động làm cả 2 bước (deploy + init)

**Verify contract có withdraw function:**
```bash
# Check ABI có withdraw function không
cat contracts/InterbankTransfer.json | grep -A 5 '"name":"withdraw"'
```

### 3.6. Kiểm tra InterbankTransfer đã deploy

Kiểm tra contract address trong GUI config:

```bash
cat ../../GUI/web/config/contracts.ts | grep INTERBANK_TRANSFER_ADDRESS
```

Hoặc kiểm tra trực tiếp trên blockchain:

```bash
# Thay CONTRACT_ADDRESS bằng address thực tế
curl -X POST http://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{
    "jsonrpc":"2.0",
    "method":"eth_getCode",
    "params":["CONTRACT_ADDRESS", "latest"],
    "id":1
  }'
```

Nếu có code (không phải "0x"), contract đã được deploy! ✅

### 3.7. Deploy PKI Registry

> **⚠️ QUAN TRỌNG:** Bước này **PHẢI** được thực hiện **SAU KHI**:
> - ✅ Blockchain đã khởi động và sẵn sàng (Bước 1 & 2)
> - ✅ InterbankTransfer contract đã được deploy (Bước 3.1-3.6)

**⭐ Bước mới:** Deploy PKI Registry để quản lý users

**Tổng quan PKI Registry:**
- ✅ **User Identity Management** - Lưu PQC public keys (Dilithium3)
- ✅ **KYC Verification** - Privacy-preserving KYC compliance  
- ✅ **Authorization Control** - Transfer permissions & daily limits
- ✅ **Key Rotation** - Crypto-agility support

**Workflow:**
```
1. User registers → Store PQC public key
2. Bank verifies KYC → Store KYC hash (not PII!)
3. Bank sets authorization → Daily limits
4. User transfers → Check KYC + limits
5. System records usage → Update daily counter
```

**Deploy PKI Registry:**

```bash
cd Besu-hyperledger/smart_contracts

# Đảm bảo contracts đã được compile
node scripts/compile.js

# Deploy PKI Registry (với TLS)
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/deploy_pki.js
unset NODE_TLS_REJECT_UNAUTHORIZED

# Hoặc không TLS
RPC_ENDPOINT=http://localhost:21001 node scripts/deploy_pki.js
```

**Expected output:**
```
========================================
PKI Registry Contract Deployment
========================================

✅ Contract deployed at: 0x...
✅ Address saved to: PKIRegistry.address.txt

🔐 Authorizing banks...
✅ SBV, VCB, VTB, BIDV authorized

👤 Registering test users...
✅ 2 users registered with KYC verified

========================================
✅ PKI Registry Deployment Complete!
========================================
```

**PKI Features:**

**User Identity:**
- Address
- PQC Public Key (Dilithium3, ~1952 bytes)
- Key Hash
- Active status
- Registration timestamp

**KYC Information (Privacy-Preserving):**
- Verified status
- Verification & expiration dates
- KYC Hash (NOT actual PII data!)
- Verifier (bank address)

**Authorization:**
- Can Transfer / Can Receive permissions
- Daily transfer limit (wei)
- Usage tracking (resets daily)

**🔒 Security Note:** PKI chỉ lưu HASH của KYC data, KHÔNG lưu CCCD/Passport/PII thật!

### 3.8. Link PKI to InterbankTransfer

> **⚠️ QUAN TRỌNG:** Bước này **PHẢI** được thực hiện **SAU KHI**:
> - ✅ InterbankTransfer contract đã được deploy (Bước 3.1-3.6)
> - ✅ PKI Registry contract đã được deploy (Bước 3.7)

**⭐ Bước quan trọng:** Kết nối PKI vào InterbankTransfer

```bash
# Link contracts (với TLS)
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/link_pki_interbank.js
unset NODE_TLS_REJECT_UNAUTHORIZED

# Hoặc không TLS
RPC_ENDPOINT=http://localhost:21001 node scripts/link_pki_interbank.js
```

**Expected output:**
```
========================================
Linking PKI Registry to InterbankTransfer
========================================

✅ PKI Registry: 0x...
✅ InterbankTransfer: 0x...

🔗 Linking...
  ✅ PKI Registry linked!
  ✅ PKI Enabled: true

📝 GUI config updated

========================================
✅ PKI Integration Complete!
========================================
```

**Test PKI Functionality (Optional):**

```bash
# Test getting user info và các chức năng PKI
cd Besu-hyperledger/smart_contracts

# Với TLS
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/test_pki.js
unset NODE_TLS_REJECT_UNAUTHORIZED

# Hoặc không TLS
RPC_ENDPOINT=http://localhost:21001 node scripts/test_pki.js
```

**Key tests:**
- ✅ Get User Info (address, key hash, registration date)
- ✅ Check KYC Validity
- ✅ Check Transfer Permission (with daily limits)
- ✅ Get PQC Public Key
- ✅ Record Transfer Usage
- ✅ Key Rotation

**Chi tiết:** Xem [PKI_INTEGRATION_GUIDE.md](../deployment/PKI_INTEGRATION_GUIDE.md)

### 3.9. Verify All Contracts

```bash
# Check InterbankTransfer
cat contracts/InterbankTransfer.address.txt

# Check PKI Registry
cat contracts/PKIRegistry.address.txt

# Check GUI config
cat ../../GUI/web/config/contracts.ts | grep -E "(INTERBANK|PKI)"
```

**Expected output:**
```typescript
export const INTERBANK_TRANSFER_ADDRESS = '0x...';
export const PKI_REGISTRY_ADDRESS = '0x...';
```

✅ **Tất cả contracts đã sẵn sàng!**

---

## Bước 4: Khởi động Web GUI

### 4.1. Di chuyển đến thư mục GUI

```bash
cd ../../GUI/web
```

Hoặc từ project root:

```bash
cd GUI/web
```

### 4.2. Cài đặt dependencies (nếu chưa có)

```bash
npm install --legacy-peer-deps
```

**Note:** Dashboard sử dụng `recharts` library cho Transaction Analytics Chart. Nếu chưa có, sẽ tự động install khi chạy `npm install`.

### 4.3. Kiểm tra cấu hình

Đảm bảo RPC endpoint đúng trong `config/blockchain.ts`:

```typescript
export const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'http://localhost:21001';
```

Đảm bảo contract address đúng trong `config/contracts.ts`:

```typescript
export const INTERBANK_TRANSFER_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x...';
```

### 4.4. Chạy development server

```bash
npm run dev
```

**Kết quả mong đợi:**
```
   ▲ Next.js 16.0.5
   - Local:        http://localhost:3000
   - Network:      http://192.168.x.x:3000

 ✓ Ready in X.Xs
```

### 4.5. Mở trình duyệt

Truy cập: **http://localhost:3000**

Bạn sẽ thấy:
- **Navigation bar** với 1 tab: 🏠 Home
- **Modern Dashboard** (truy cập từ Home page) với:
  - 📊 **Balance Card** (emerald gradient design)
  - 🔐 **PKI & Security Info** (tích hợp trong Dashboard)
  - 📈 **Transaction Analytics Chart** (đỏ = chuyển đi, xanh = nhận về)
  - 📊 **Stats Cards** (Completed, Sent, Received, Pending)
  - 📋 **Recent Transactions** list
  - 💸 **Transfer functionality** (tích hợp trong Dashboard)
- Menu điều hướng đầy đủ

### 4.6. Accept TLS Certificate (nếu dùng TLS)

Do sử dụng self-signed certificate:

**Option 1: Accept trong browser** (khuyên dùng)
1. Truy cập `https://localhost:21001` trực tiếp
2. Click "Advanced" → "Accept Risk and Continue"
3. Quay lại GUI: `http://localhost:3000`

**Option 2: Import CA certificate**
```bash
# Import SBV Root CA vào system
sudo cp Besu-hyperledger/config/tls/ca/certs/sbv-root-ca.crt \
  /usr/local/share/ca-certificates/sbv-interbank.crt
sudo update-ca-certificates

# Restart browser để áp dụng
```

### 4.7. Chọn ngân hàng và user

1. Chọn ngân hàng từ dropdown (Vietcombank, Vietinbank, BIDV)
2. Chọn user (User 1 hoặc User 2)
3. Kiểm tra số dư hiển thị đúng (100,000,000 VND = 100 ETH)

---

## Bước 5: Sử dụng Dashboard (All-in-One)

> **⭐ TÍNH NĂNG MỚI:** Dashboard là trang all-in-one, tích hợp tất cả tính năng:
> - ✅ Balance & Account Info
> - ✅ PKI & Security Info (tích hợp, không còn tab riêng)
> - ✅ Transaction Analytics Chart
> - ✅ Transfer functionality (tích hợp trong Dashboard)
> - ✅ Recent Transactions list
> 
> **Không còn các trang riêng:** `/transfer` và `/transactions` đã được tích hợp vào Dashboard

### 5.1. Access Dashboard

1. Chọn ngân hàng từ Home page
2. Dashboard tự động hiển thị với tất cả tính năng:
   - **Balance Card** (số dư tài khoản)
   - **PKI & Security Info Card** (bên cạnh balance)
   - **Transaction Analytics Chart** (biểu đồ giao dịch)
   - **Stats Cards** (thống kê)
   - **Recent Transactions** (danh sách giao dịch gần đây)
   - **Transfer functionality** (tích hợp trong Dashboard)

### 5.2. Dashboard Features

**📊 Balance Card (Top Left - 2 columns):**
- ✅ Số dư tài khoản (large display)
- ✅ User address (truncated)
- ✅ Quick stats: Sent/Received count
- ✅ Modern emerald gradient design

**🔐 PKI & Security Info Card (Top Right - 1 column):**
- ✅ **Account Status:** Active/Inactive badge
- ✅ **KYC Status:** Verified/Not Verified với dates
- ✅ **Permissions:** Transfer/Receive (Allowed/Denied)
- ✅ **Daily Limit Progress Bar:**
  - Current usage / Total limit (ETH)
  - Visual progress bar với màu động:
    - 🟢 Green: <70% used
    - 🟡 Yellow: 70-90% used
    - 🔴 Red: >90% used
  - Percentage display
- ✅ **Quantum-Resistant Badge** (PQC enabled)

**📈 Transaction Analytics Chart (NEW!):**
- ✅ **Bar Chart** hiển thị 7 ngày gần nhất
- ✅ **🔴 Red bars:** Chuyển đi (Sent transactions)
- ✅ **🟢 Green bars:** Nhận về (Received transactions)
- ✅ **Summary stats:** Total Sent / Total Received
- ✅ Interactive tooltips

**📊 Stats Cards (4 cards):**
- ✅ **Completed:** Số giao dịch hoàn tất
- ✅ **Transfers:** Số giao dịch chuyển đi
- ✅ **Received:** Số giao dịch nhận về
- ✅ **Pending:** Số giao dịch đang chờ

**📋 Recent Transactions:**
- ✅ Danh sách 5 giao dịch gần nhất
- ✅ Color-coded amounts (đỏ = gửi, xanh = nhận)
- ✅ Status badges (Completed/Pending/In Progress)
- ✅ Direction icons (⬆️ = sent, ⬇️ = received)

### 5.3. Test Dashboard Flow

**Scenario: Check Daily Limit After Transfer**

1. Open Dashboard → Check PKI Card → Daily Limit (e.g., 0/100 ETH)
2. Use Transfer functionality in Dashboard → Create transfer 10 ETH
3. Submit transaction
4. Dashboard automatically updates → PKI Card shows updated usage (10/100 ETH used)
5. Progress bar shows 10% (green)

**Scenario: View Transaction Chart**

1. Open Dashboard
2. Scroll to "Transaction Analytics" chart
3. See bar chart với:
   - 🔴 Red bars = Sent transactions
   - 🟢 Green bars = Received transactions
4. Hover over bars để xem chi tiết
5. Check summary stats at bottom (Total Sent/Received)

**Scenario: View KYC Status**

1. Open Dashboard
2. Check PKI & Security Info Card (top right)
3. Verify:
   - ✅ KYC Status: Verified
   - ✅ Verified At & Expires At dates
   - ✅ Permissions: Transfer/Receive allowed

**Scenario: Monitor Transaction Stats**

1. Open Dashboard
2. View Stats Cards:
   - Completed count
   - Transfers count (outgoing)
   - Received count (incoming)
   - Pending count
3. Check Recent Transactions list below
4. Verify color coding: red = sent, green = received

### 5.4. Dashboard Layout

**Expected UI Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Dashboard                                                    │
│ Plan, prioritize, and accomplish your tasks with ease.       │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┐  ┌──────────────────┐          │
│ │ Balance Card (2 cols)    │  │ PKI Info (1 col) │          │
│ │ 🟢 Emerald Gradient      │  │ 🔐 PKI & Security│          │
│ │ 100,000,000 VND          │  │ ✅ Active        │          │
│ │ 0x6423...e34e            │  │ ✅ KYC Verified  │          │
│ │ Sent: 5  Received: 3    │  │ Daily Limit: 10% │          │
│ └──────────────────────────┘  └──────────────────┘          │
├─────────────────────────────────────────────────────────────┤
│ Stats Cards (4 cards)                                        │
│ [Completed: 12] [Transfers: 5] [Received: 3] [Pending: 2]   │
├─────────────────────────────────────────────────────────────┤
│ Transaction Analytics Chart                                  │
│ ┌──────────────────────────────────────────────────────┐    │
│ │  Bar Chart (7 days)                                   │    │
│ │  🔴 Red = Sent    🟢 Green = Received                │    │
│ │  [Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun]          │    │
│ │  Total Sent: 50,000,000 VND                           │    │
│ │  Total Received: 30,000,000 VND                      │    │
│ └──────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│ Recent Transactions                                          │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ ⬆️ Chuyển tiền    -10,000,000 VND  [Completed]      │    │
│ │ ⬇️ Nhận tiền      +5,000,000 VND   [Completed]      │    │
│ │ ...                                                 │    │
│ └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 5.5. Troubleshooting Dashboard

**Issue: "User not registered in PKI Registry"**
```bash
# Solution: Deploy PKI and register users
cd Besu-hyperledger/smart_contracts
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/deploy_pki.js
```

**Issue: "PKI Registry not found" hoặc PKI Card không hiển thị**
```bash
# Solution: Link PKI to InterbankTransfer
node scripts/link_pki_interbank.js
```

**Issue: Profile shows "Loading..." forever**
```bash
# Check blockchain is running
docker ps | grep besu

# Check PKI contract deployed
cat smart_contracts/contracts/PKIRegistry.address.txt

# Check browser console (F12) for errors
```

---

## Troubleshooting

### ❌ Blockchain không khởi động

**Lỗi:** `docker-compose up` fails

**Giải pháp:**
```bash
# Kiểm tra ports có bị chiếm không
netstat -tuln | grep -E '21001|21002|21003|21004'

# Dừng và xóa containers cũ
cd Besu-hyperledger
docker-compose down -v

# Xóa images cũ (nếu cần)
docker-compose down --rmi all

# Chạy lại
./run.sh
```

### ❌ RPC endpoint không phản hồi

**Lỗi 1:** `curl: (7) Failed to connect to localhost:21001`

**Giải pháp:**
```bash
# Kiểm tra container có đang chạy không
docker ps | grep sbv

# Xem logs của container
docker logs besu-hyperledger-sbv-1

# Đợi thêm vài phút để blockchain khởi động hoàn toàn
sleep 60
curl -X POST http://localhost:21001 ...
```

**Lỗi 2:** `curl: (52) Empty reply from server`

**Nguyên nhân:** Node chạy với TLS (HTTPS only) nhưng bạn dùng HTTP

**Giải pháp:**
```bash
# Kiểm tra TLS có enabled không
docker logs besu-hyperledger-sbv-1 2>&1 | grep "TLS enabled"

# Nếu thấy "with TLS enabled", dùng HTTPS:
curl -k --tlsv1.3 \
  -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Hoặc với CA cert:
curl --cacert config/tls/ca/certs/sbv-root-ca.crt --tlsv1.3 \
  -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### ❌ Contract deploy thất bại

**Lỗi 1:** `Cannot connect to RPC` hoặc `Empty reply from server`

**Nguyên nhân:** Blockchain chạy với TLS nhưng script dùng HTTP

**Giải pháp:**
```bash
# Option 1: Deploy với HTTPS (Recommended)
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/public/deploy_and_init.js
unset NODE_TLS_REJECT_UNAUTHORIZED

# Option 2: Kiểm tra xem node có HTTP port không
docker ps | grep besu
# Nếu không có HTTP, phải dùng HTTPS

# Option 3: Test connection trước
NODE_TLS_REJECT_UNAUTHORIZED=0 RPC_ENDPOINT=https://localhost:21001 \
  node scripts/test_tls_connection.js
```

**Lỗi 2:** `transaction execution reverted` hoặc `insufficient funds`

**Giải pháp:**
```bash
# Kiểm tra blockchain đã sẵn sàng
# Với TLS:
curl --cacert config/tls/ca/certs/sbv-root-ca.crt \
  -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Không TLS:
curl -X POST http://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Kiểm tra account có ETH không (trong genesis)
# Deploy lại với gas limit cao hơn nếu cần
```

**Lỗi 3:** `init_contract.js` dùng contract address cũ thay vì address mới

**Nguyên nhân:** Script đọc address từ file cũ hoặc env var không được set

**Giải pháp:**
```bash
# Option 1: Dùng deploy_and_init.js (tự động sync address)
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/public/deploy_and_init.js
unset NODE_TLS_REJECT_UNAUTHORIZED

# Option 2: Set explicit CONTRACT_ADDRESS env var
export CONTRACT_ADDRESS=0x...  # Address mới vừa deploy
RPC_ENDPOINT=https://localhost:21001 node scripts/public/init_contract.js

# Option 3: Kiểm tra và update file address
cat contracts/InterbankTransfer.address.txt  # Xem address hiện tại
# Nếu sai, update file hoặc dùng env var

# Option 4: Script tự động đọc từ file, đảm bảo file đúng
# Sau khi deploy, file sẽ được tự động update
```

**Lỗi 3:** `self-signed certificate in certificate chain`

**Nguyên nhân:** Node.js 22 strict về TLS certificates

**Giải pháp:**
```bash
# Dùng workaround (development only!)
export NODE_TLS_REJECT_UNAUTHORIZED=0
# ... deploy commands ...
unset NODE_TLS_REJECT_UNAUTHORIZED

# Chi tiết: smart_contracts/DEPLOY_WITH_TLS.md
```

**Lỗi 4:** `transaction execution reverted` khi authorize hoặc deposit

**Nguyên nhân có thể:**
- PKI enabled nhưng users chưa được register trong PKI Registry
- Contract address không đúng
- Gas limit không đủ

**Giải pháp:**
```bash
# 1. Kiểm tra PKI status
# Script init_contract.js sẽ hiển thị "PKI Enabled: true/false"
# Nếu PKI enabled, cần register users trước

# 2. Nếu PKI enabled, disable tạm thời để init:
# (Chỉ dùng khi init lần đầu, sau đó enable lại)
# Trong InterbankTransfer contract:
# togglePKI(false)  # Disable PKI
# ... init users ...
# togglePKI(true)   # Enable PKI lại

# 3. Hoặc register users trong PKI trước khi init:
cd smart_contracts
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/deploy_pki.js
# Sau đó init contract

# 4. Kiểm tra contract address đúng:
# Script sẽ hiển thị "📋 Using Contract Address: 0x..."
# Verify address này match với address vừa deploy

# 5. Tăng gas limit nếu cần:
# Edit init_contract.js, tăng gasLimit trong transaction options
```

### ❌ Web GUI không kết nối được blockchain

**Lỗi:** Balance = 0 hoặc "Network error"

**Giải pháp:**
1. Kiểm tra RPC endpoint trong `config/blockchain.ts`
2. Kiểm tra contract address trong `config/contracts.ts`
3. Kiểm tra CORS (nếu có)
4. Xem console log trong browser (F12)

### ❌ Mock Mode đang bật

**Triệu chứng:** Transactions không thực sự lên blockchain

**Giải pháp:**
Kiểm tra và tắt Mock Mode trong `config/blockchain.ts`:

```typescript
export const MOCK_MODE = false; // Đổi từ true thành false
```

Sau đó restart web dev server.

### ❌ KSM Service build failed

**Lỗi:** `cannot find symbol: class IPQCCryptoService` hoặc compilation errors

**Nguyên nhân:** Code structure issue với duplicate packages

**Giải pháp:**

```bash
cd ksm

# 1. Kiểm tra không có folder pqc duplicate
ls -la src/main/java/com/nt219/
# Chỉ nên có folder "ksm", KHÔNG có folder "pqc"

# 2. Nếu có folder pqc, xóa đi:
rm -rf src/main/java/com/nt219/pqc

# 3. Rebuild
cd ../Besu-hyperledger
docker-compose build ksm

# 4. Start lại
docker-compose up -d ksm

# 5. Verify
curl http://localhost:8080/ksm/health
```

**Lưu ý:** Tất cả PQC code phải nằm trong package `com.nt219.ksm.crypto`, KHÔNG phải `com.nt219.pqc.crypto`.

### ❌ KSM Service không khởi động

**Lỗi:** Container `ksm-service` exit ngay sau khi start

**Giải pháp:**

```bash
# Xem logs để tìm lỗi
docker logs ksm-service

# Nếu là port conflict (port 8080 đang dùng):
sudo netstat -tuln | grep 8080
# Kill process đang dùng hoặc đổi port trong docker-compose.yml

# Nếu là Java error:
# Rebuild với clean:
docker-compose down
docker-compose build --no-cache ksm
docker-compose up -d ksm
```

### ❌ KSM API trả về 500 Internal Server Error

**Lỗi:** `curl http://localhost:8080/ksm/generateKey` trả về error

**Giải pháp:**

```bash
# 1. Kiểm tra logs chi tiết
docker logs ksm-service --tail 50

# 2. Kiểm tra request format đúng:
curl -X POST http://localhost:8080/ksm/generateKey \
  -H "Content-Type: application/json" \
  -d '{"entityId":"testbank","algorithm":"Dilithium3"}'

# 3. Restart service
docker-compose restart ksm

# 4. Nếu vẫn lỗi, check Java heap:
# Edit docker-compose.yml, thêm:
# environment:
#   - JAVA_OPTS=-Xmx512m -Xms256m
```

### ❌ TLS connection failed

**Lỗi:** `certificate verify failed` hoặc `SSL handshake failed`

**Giải pháp:**

1. **Kiểm tra TLS đã được setup:**
```bash
cd Besu-hyperledger
ls -lh config/tls/ca/certs/sbv-root-ca.crt
```

2. **Chạy test TLS:**
```bash
./scripts/test_tls.sh
```

3. **Nếu certificate chưa có, tạo lại:**
```bash
./scripts/generate_tls13_certs.sh
./scripts/generate_node_configs.sh
docker-compose restart
```

4. **Import Root CA vào system (nếu cần):**
```bash
sudo cp config/tls/ca/certs/sbv-root-ca.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates
```

5. **Xem logs để debug:**
```bash
docker logs rpcnode 2>&1 | grep -E "TLS|SSL|certificate"
```

### ❌ Besu node không khởi động với TLS

**Lỗi:** `Unknown options in TOML configuration`

**Giải pháp:**

1. **Kiểm tra config-tls.toml:**
```bash
cat config/nodes/rpcnode/config-tls.toml | grep tls
```

2. **Xem logs chi tiết:**
```bash
docker logs rpcnode --tail 50
```

3. **Nếu vẫn lỗi, chạy lại script:**
```bash
./scripts/generate_node_configs.sh
docker-compose restart
```

**Chi tiết troubleshooting TLS:** Xem [TLS13_SETUP_GUIDE.md](../deployment/TLS13_SETUP_GUIDE.md#troubleshooting)

---

## Quick Start (Tóm tắt nhanh)

### 🔐 Quick Start với TLS 1.3 + PQC + PKI (Full Security - Khuyên dùng)

Copy-paste các lệnh sau để chạy nhanh với bảo mật đầy đủ:

```bash
# 0A. Thiết lập TLS 1.3
cd Besu-hyperledger
./scripts/generate_tls13_certs.sh
./scripts/generate_node_configs.sh

# 0B. Build KSM service (lần đầu hoặc khi code thay đổi)
docker-compose build ksm

# 1. Khởi động blockchain + KSM
docker-compose up -d

# Đợi 1-2 phút, sau đó kiểm tra:
./scripts/test_tls.sh
curl http://localhost:8080/ksm/health

# Generate PQC keys cho banks
curl -X POST http://localhost:8080/ksm/generateKey \
  -H "Content-Type: application/json" \
  -d '{"entityId":"vietcombank"}'

curl -X POST http://localhost:8080/ksm/generateKey \
  -H "Content-Type: application/json" \
  -d '{"entityId":"vietinbank"}'

curl -X POST http://localhost:8080/ksm/generateKey \
  -H "Content-Type: application/json" \
  -d '{"entityId":"bidv"}'

# 2. Deploy contracts (với TLS)
cd smart_contracts
npm install --legacy-peer-deps  # Chỉ cần chạy 1 lần

# Compile contracts
node scripts/compile.js

# Deploy InterbankTransfer (tự động init authorize + deposit)
# Script sẽ tự động:
# - Deploy contract
# - Lưu address vào InterbankTransfer.address.txt
# - Authorize tất cả bank addresses
# - Deposit 100 ETH cho mỗi user
# - Update GUI config
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/public/deploy_and_init.js

# Deploy PKI Registry ⭐ MỚI
RPC_ENDPOINT=https://localhost:21001 node scripts/deploy_pki.js

# Link PKI to InterbankTransfer ⭐ MỚI  
RPC_ENDPOINT=https://localhost:21001 node scripts/link_pki_interbank.js
unset NODE_TLS_REJECT_UNAUTHORIZED

# 3. Chạy web GUI
cd ../../GUI/web
npm install --legacy-peer-deps  # Chỉ cần chạy 1 lần
npm run dev

# 4. Mở browser: http://localhost:3000
# 5. Explore: Home → Dashboard (tất cả tính năng trong một trang)
```

**✅ Hoàn thành! Bạn có đầy đủ:**
- 🔐 TLS 1.3 (RSA 4096 + AES-GCM)
- 🔑 PQC Signatures (Dilithium3)
- 👤 PKI Registry (KYC + Daily Limits)
- 📊 User Profile Page

**⚠️ Lưu ý về TLS:**
- `NODE_TLS_REJECT_UNAUTHORIZED=0` chỉ dùng cho development với self-signed certificates
- Production: dùng proper CA-signed certificates hoặc import CA vào system trust store
- Chi tiết: `smart_contracts/DEPLOY_WITH_TLS.md`

### Quick Start không TLS/PQC (Đơn giản nhất)

```bash
# 1. Khởi động blockchain only
cd Besu-hyperledger
./run.sh

# Đợi 1-2 phút, sau đó kiểm tra:
curl -X POST http://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# 2. Deploy contracts
cd smart_contracts
npm install --legacy-peer-deps  # Chỉ cần chạy 1 lần

# Compile
node scripts/compile.js

# Deploy InterbankTransfer
node scripts/public/deploy_and_init.js

# Deploy PKI Registry (optional nhưng khuyên dùng) ⭐
RPC_ENDPOINT=http://localhost:21001 node scripts/deploy_pki.js

# Link PKI (nếu đã deploy PKI) ⭐
RPC_ENDPOINT=http://localhost:21001 node scripts/link_pki_interbank.js

# 3. Chạy web GUI
cd ../../GUI/web
npm install --legacy-peer-deps  # Chỉ cần chạy 1 lần
npm run dev

# 4. Mở browser: http://localhost:3000
# 5. Explore: Home → Dashboard (tất cả tính năng trong một trang)
```

### Quick Start với PQC (Không TLS)

Nếu chỉ muốn test PQC mà không cần TLS:

```bash
# 1. Build và khởi động KSM + Blockchain
cd Besu-hyperledger
docker-compose build ksm
docker-compose up -d

# 2. Generate PQC keys
curl -X POST http://localhost:8080/ksm/generateKey \
  -H "Content-Type: application/json" \
  -d '{"entityId":"vietcombank"}'

curl -X POST http://localhost:8080/ksm/generateKey \
  -H "Content-Type: application/json" \
  -d '{"entityId":"vietinbank"}'

# 3. Test PQC signing
curl -X POST http://localhost:8080/ksm/sign \
  -H "Content-Type: application/json" \
  -d '{"entityId":"vietcombank","message":"Test transaction"}'

# 4. Deploy contract và chạy GUI (như trên)
cd smart_contracts
node scripts/public/deploy_and_init.js
cd ../../GUI/web
npm run dev
```

---

## 📝 Lưu ý quan trọng

1. **Thứ tự thực hiện:** 
   - **Full Security:** TLS Setup (0A) → PQC/KSM Setup (0B) → **Blockchain (1)** → Deploy InterbankTransfer (3.1-3.6) → **Deploy PKI Registry (3.7)** → Link PKI (3.8) → Web GUI (4)
   - **Đơn giản:** **Blockchain (1)** → Deploy InterbankTransfer (3.1-3.6) → **Deploy PKI Registry (3.7)** → Link PKI (3.8) → Web GUI (4)
   - **⚠️ QUAN TRỌNG:** Blockchain **PHẢI** chạy trước khi deploy bất kỳ contract nào (bao gồm PKI Registry)!
   - **⚠️ Deploy lại Contract:** Nếu contract code thay đổi (ví dụ: thêm withdraw function), cần deploy lại (Bước 3.6)
2. **Thời gian chờ:** Blockchain cần 1-2 phút để khởi động hoàn toàn
3. **Contract address:** 
   - Mỗi lần deploy sẽ có address mới, script sẽ tự động cập nhật GUI config
   - `deploy_and_init.js` tự động sync contract address giữa deploy và init
   - `init_contract.js` tự động đọc address từ file hoặc env var (ưu tiên env var)
   - Script hiển thị contract address đang sử dụng để debug: `📋 Using Contract Address: 0x...`
4. **Reset blockchain:** Nếu reset blockchain (xóa volumes), phải deploy lại contract
5. **TLS 1.3:** 
   - Chỉ cần setup TLS 1 lần (certificates có hiệu lực 825 ngày)
   - TLS sẽ tự động kích hoạt khi khởi động blockchain nếu certificates đã có
   - Kiểm tra TLS: `./scripts/test_tls.sh`
6. **PQC/KSM:**
   - Build KSM lần đầu: `docker-compose build ksm`
   - KSM service khởi động qua docker-compose: `docker-compose up -d ksm`
   - Generate keys cho banks sau khi KSM ready
   - Check health: `curl http://localhost:8080/ksm/health`
   - Check logs: `docker logs ksm-service`
   - **🔒 PQC ENABLED BY DEFAULT trong GUI** (Dec 2025) - không cần config
   - PQC implementation hiện tại là simulation - thay bằng thư viện thực trong production
   - **Build fixes (Dec 2025):** Fixed package structure issues, eliminated duplicate PQC folder
   - **Configuration:** `GUI/web/config/pqc.ts` với `PQC_ENABLED_DEFAULT = true`
7. **Smart Contract Scripts (Dec 2025):**
   - **`deploy_and_init.js`:** Tự động deploy và init contract, sync address giữa các bước
   - **`init_contract.js`:** Cải tiến với:
     - ✅ Tự động đọc contract address từ file hoặc env var (ưu tiên env var)
     - ✅ Hỗ trợ HTTPS với TLS (tự động detect)
     - ✅ Kiểm tra PKI enabled status và hiển thị warning
     - ✅ Hiển thị contract address đang sử dụng để debug
     - ✅ Better error handling và logging
   - **Contract address management:** Scripts tự động sync address, không cần manual update
8. **PKI Registry:**
   - **⚠️ Thứ tự quan trọng:** PKI Registry **PHẢI** được deploy **SAU KHI** blockchain đã chạy và InterbankTransfer đã được deploy
   - Deploy PKI: `node scripts/deploy_pki.js` (sau Bước 1 & 2)
   - Link PKI: `node scripts/link_pki_interbank.js` (sau khi cả 2 contracts đã deploy)
   - Test PKI: `node scripts/test_pki.js` (optional, để verify)
   - **Chi tiết:** Xem [PKI_INTEGRATION_GUIDE.md](../deployment/PKI_INTEGRATION_GUIDE.md)
9. **Bảo mật:** 
   - Password mặc định của keystores là `changeit` - đổi trong production!
   - Root CA private key được mã hóa tại `config/tls/ca/private/sbv-root-ca.key`
   - PQC private keys lưu trong memory - cần HSM trong production

---

## 🔗 Tài liệu liên quan

### Security & Cryptography
- [TLS 1.3 Setup Guide](../deployment/TLS13_SETUP_GUIDE.md) - Hướng dẫn chi tiết thiết lập TLS 1.3
- [TLS Setup Summary](../../Besu-hyperledger/TLS_SETUP_SUMMARY.md) - Tóm tắt cấu hình TLS
- [PQC Configuration Guide](../../GUI/web/PQC_CONFIGURATION.md) - 🔒 **Hướng dẫn cấu hình PQC (Enabled by default)**
- [PQC Default Enabled](../../PQC_DEFAULT_ENABLED.md) - Tóm tắt PQC enabled by default
- [PQC/KSM Integration Analysis](../architecture/PQC_KSM_INTEGRATION_ANALYSIS.md) - Phân tích tích hợp PQC
- [PQC/KSM Summary](../../PQC_KSM_INTEGRATION_SUMMARY.md) - Tóm tắt PQC/KSM
- [KSM Build Fixes](../../KSM_BUILD_FIXES.md) - Fix compilation errors (Dec 2025)

### General
- [Quick Reset Guide](./QUICK_RESET_GUIDE.md) - Hướng dẫn reset blockchain nhanh
- [Deployment Guide](../deployment/BLOCKCHAIN_SETUP.md) - Chi tiết setup blockchain
- [Architecture](../architecture/ARCHITECTURE.md) - Kiến trúc hệ thống
- [Deploy with TLS](../../Besu-hyperledger/smart_contracts/DEPLOY_WITH_TLS.md) - 🔐 **Deploy contracts với TLS**

### Reference
- [NT219 BaoCaoTienDo-2](../reference/NT219_BaoCaoTienDo-2.pdf) - Báo cáo tiến độ
  - Section 5.1: Track A - PQC Signatures
  - Section 6.2: Deployment - TLS 1.3 + KSM
- [TLS Commands Cheat Sheet](./RUNBOOK_TLS_CHEAT_SHEET.md) - 🔐 **Quick TLS reference**

---

## 🔐 TLS Commands Cheat Sheet

### Quick Reference: HTTP vs HTTPS

**⚠️ Quan trọng:** Khi blockchain chạy với TLS, node **CHỈ ACCEPT HTTPS**, không accept HTTP!

| Scenario | Endpoint | Example |
|----------|----------|---------|
| **With TLS** | `https://localhost:21001` | `curl -k --tlsv1.3 -X POST https://localhost:21001 ...` |
| **Without TLS** | `http://localhost:21001` | `curl -X POST http://localhost:21001 ...` |

### Check if TLS is enabled

```bash
docker logs besu-hyperledger-sbv-1 2>&1 | grep "TLS enabled"

# If you see: "JSON-RPC service started ... with TLS enabled"
# → Use HTTPS
```

### curl Commands with TLS

```bash
# Option 1: Secure (với CA certificate)
curl --cacert config/tls/ca/certs/sbv-root-ca.crt --tlsv1.3 \
  -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Option 2: Quick test (insecure - skip cert verification)
curl -k --tlsv1.3 \
  -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### Node.js Scripts with TLS

```bash
# Deploy contract với TLS
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/public/deploy_and_init.js
unset NODE_TLS_REJECT_UNAUTHORIZED

# Check balance với TLS
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/public/check_balance.js
unset NODE_TLS_REJECT_UNAUTHORIZED
```

### Test Scripts

```bash
# Test TLS connection
cd smart_contracts
NODE_TLS_REJECT_UNAUTHORIZED=0 RPC_ENDPOINT=https://localhost:21001 \
  node scripts/test_tls_connection.js

# Test blockchain TLS setup
cd ..
./scripts/test_tls.sh

# Test KSM service
curl http://localhost:8080/ksm/health

# Test PKI Registry ⭐ MỚI
cd smart_contracts
node scripts/test_pki.js
```

### PKI Commands ⭐ MỚI

```bash
# Deploy PKI Registry
cd smart_contracts
RPC_ENDPOINT=https://localhost:21001 node scripts/deploy_pki.js

# Link PKI to InterbankTransfer
RPC_ENDPOINT=https://localhost:21001 node scripts/link_pki_interbank.js

# Test PKI functionality
node scripts/test_pki.js

# Check user KYC status
curl -k -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"PKI_REGISTRY_ADDRESS",
      "data":"0x..."
    },"latest"],
    "id":1
  }'

# Register new user (from user wallet)
# See: scripts/register_user_example.js
```

### GUI Features

```bash
# Access pages:
http://localhost:3000/          # Home (bank selection)
http://localhost:3000/bank/[code]/dashboard  # Dashboard (tất cả tính năng)
http://localhost:3000/bank/[code]/withdraw   # Withdraw page (rút tiền)

# Dashboard features:
# - Modern Balance Card (emerald gradient)
# - PKI & Security Info Card (tích hợp)
# - Transaction Analytics Chart (🔴 đỏ = sent, 🟢 xanh = received)
# - Stats Cards (Completed, Sent, Received, Pending)
# - Recent Transactions list với color coding
# - Transfer functionality (tích hợp trong Dashboard)

# Withdraw page features: ⭐ MỚI
# - User Selector (dropdown để chọn user dễ dàng)
# - Withdraw từ contract balance (nếu contract deployed)
# - Fallback to native transfer (nếu contract chưa deploy)
# - OTP verification (mock)
# - Real-time balance update sau khi rút tiền
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Empty reply from server` | Using HTTP when TLS enabled | Use `https://` instead of `http://` |
| `self-signed certificate` | Node.js strict validation | Set `NODE_TLS_REJECT_UNAUTHORIZED=0` |
| `Connection refused` | Node not running | `docker-compose up -d` |
| `User not registered in PKI Registry` ⭐ | User chưa register trong PKI | Run `node scripts/deploy_pki.js` |
| `KYC not valid` ⭐ | KYC chưa verify hoặc đã hết hạn | Bank verify KYC: `verifyKYC(user, hash, days)` |
| `Transfer not authorized` ⭐ | Vượt daily limit hoặc no permission | Bank set auth: `setAuthorization(user, ...)` |

### Security Notes

⚠️ **Development workaround:**
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0  # Disable cert verification
curl -k                          # Skip cert verification
```

**Production:** Use proper CA-signed certificates or import self-signed CA to system trust store.

**See full cheat sheet:** [RUNBOOK_TLS_CHEAT_SHEET.md](./RUNBOOK_TLS_CHEAT_SHEET.md)

---

## 🎯 System Architecture Summary

**Hệ thống đầy đủ theo báo cáo NT219_BaoCaoTienDo-2.pdf:**

```
┌────────────────────────────────────────────┐
│         USER LAYER                          │
│  Browser → http://localhost:3000           │
│  Pages: Home | Dashboard (all-in-one) ⭐   │
│  Dashboard: Balance + PKI + Charts + Transfer │
└────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│         SECURITY LAYER                      │
│  • TLS 1.3 (RSA 4096 + AES-GCM-256)        │
│  • PQC Signatures (Dilithium3)             │
│  • PKI Registry (KYC + Auth) ⭐            │
└────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│         BLOCKCHAIN LAYER                    │
│  • 8 Besu Nodes (QBFT Consensus)           │
│  • Smart Contracts:                         │
│    - InterbankTransfer (with PKI) ⭐       │
│    - PKIRegistry ⭐                         │
│    - STARKVerifier (Track B - future)      │
└────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│         SERVICE LAYER                       │
│  • KSM (Port 8080) - PQC signing           │
│  • ZKP Prover (Port 8081) - STARK proofs   │
└────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│         MONITORING LAYER                    │
│  • Blockscout (Port 26000)                 │
│  • Grafana (Port 3001)                     │
│  • Prometheus (Port 9090)                  │
└────────────────────────────────────────────┘
```

**Deployed Contracts:**
- ✅ `InterbankTransfer` - Main transfer logic + PKI integration ⭐
- ✅ `PKIRegistry` - User identity, KYC, authorization ⭐
- ⏳ `STARKVerifier` - ZK proof verification (Track B)

**Services Running:**
- ✅ 8x Besu Nodes (blockchain)
- ✅ KSM Service (PQC signing - Dilithium3)
- ✅ Monitoring tools (Blockscout, Grafana)
- ⏳ ZKP Prover (Winterfell STARK - Track B)

**GUI Features:**
- ✅ Home page (bank selection)
- ✅ **Modern Dashboard** (tất cả tính năng trong một trang) ⭐
  - Balance Card với emerald gradient
  - PKI & Security Info Card (tích hợp)
  - Transaction Analytics Chart (đỏ/xanh)
  - Stats Cards & Recent Transactions
  - Transfer functionality (tích hợp với PKI verification) ⭐

**Security Features Implemented:**
- ✅ TLS 1.3 (mTLS ready)
- ✅ AES-GCM encryption
- ✅ RSA 4096-bit certificates
- ✅ PQC signatures (Dilithium3)
- ✅ KSM persistent storage (AES-256-CBC)
- ✅ PKI Registry (KYC + daily limits) ⭐
- ✅ Key rotation support
- ⏳ ZK-STARK proofs (Track B)

---

## 🎯 Checklist hoàn thành

**Infrastructure:**
- [ ] TLS 1.3 certificates generated
- [ ] Node configs với TLS created
- [ ] Blockchain network running (8 nodes)
- [ ] All nodes healthy and peering

**PQC/KSM:**
- [ ] KSM service built & running
- [ ] PQC keys generated cho banks
- [ ] Keys persisted in ksm-data/
- [ ] KSM API tested

**Smart Contracts:**
- [ ] InterbankTransfer deployed
- [ ] PKI Registry deployed ⭐
- [ ] PKI linked to InterbankTransfer ⭐
- [ ] Test users registered with KYC ⭐
- [ ] All bank addresses authorized

**GUI:**
- [ ] GUI running on localhost:3000
- [ ] Home page loads (bank selection)
- [ ] Dashboard displays correctly ⭐
  - [ ] Balance Card shows correct balance
  - [ ] PKI & Security Info Card visible
  - [ ] Transaction Chart displays (đỏ/xanh)
  - [ ] Stats Cards show correct counts
  - [ ] Recent Transactions list works
  - [ ] Transfer functionality working in Dashboard
- [ ] PKI info displaying correctly in Dashboard ⭐
- [ ] Daily limits tracking in Dashboard ⭐

**Testing:**
- [ ] Blockchain responding to RPC
- [ ] TLS 1.3 verified
- [ ] PQC signing/verification working
- [ ] Dashboard transfers with PKI verification ⭐
- [ ] Daily limits enforced ⭐
- [ ] KYC checks working ⭐

**✅ Hệ thống hoàn chỉnh: TLS 1.3 + PQC + PKI Registry!**

---

**Chúc bạn thành công! 🎉**

**📚 Tài liệu tham khảo:**
- [PKI Integration Guide](../deployment/PKI_INTEGRATION_GUIDE.md) ⭐
- [ZKP Winterfell Deployment](../deployment/ZKP_WINTERFELL_DEPLOYMENT.md) ⭐
- [Quy trình triển khai PQC](../deployment/QUY_TRINH_TRIEN_KHAI_PQC.md) ⭐
- [TLS 1.3 Setup Guide](../deployment/TLS13_SETUP_GUIDE.md)

