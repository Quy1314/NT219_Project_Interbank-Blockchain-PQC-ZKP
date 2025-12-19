# 🚀 Runbook - Hướng dẫn chạy hệ thống từ đầu

Runbook này hướng dẫn chi tiết cách khởi động hệ thống từ đầu: từ blockchain, deploy contract, đến chạy web dev.

## 🎯 Quick Decision Guide

**🔐 Full Security (TLS 1.3 + PQC + PKI + ZKP) - Khuyên dùng**

Follow [Quick Start Full Security](#-quick-start-với-tls-13--pqc-full-security---khuyên-dùng) để có đầy đủ bảo mật theo yêu cầu NT219_BaoCaoTienDo-2.pdf.

**⚠️ QUAN TRỌNG:** ZKP Balance Proof là **BẮT BUỘC** để đảm bảo privacy và security cho hệ thống!

**💡 Important:** Khi TLS enabled, node **CHỈ** accept **HTTPS** (`https://localhost:21001`), không accept HTTP!

## 📋 Mục lục

1. [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
2. [Bước 0A: Thiết lập TLS 1.3 (Khuyên dùng)](#bước-0a-thiết-lập-tls-13-khuyên-dùng)
3. [Bước 0B: Thiết lập PQC/KSM (Post-Quantum Crypto)](#bước-0b-thiết-lập-pqcksm-post-quantum-crypto)
4. [Bước 1: Khởi động Blockchain](#bước-1-khởi-động-blockchain)
5. [Bước 2: Kiểm tra Blockchain](#bước-2-kiểm-tra-blockchain)
6. [Bước 3: Deploy Smart Contracts](#bước-3-deploy-smart-contracts) **⭐ CẬP NHẬT**
   - [3.1-3.4: Deploy InterbankTransfer](#bước-3-deploy-smart-contracts)
   - [3.5: Deploy PKI Registry](#bước-35-deploy-pki-registry-user-management) **⭐ MỚI**
   - [3.6: Link PKI to InterbankTransfer](#bước-36-link-pki-to-interbanktransfer) **⭐ MỚI**
   - [3.8: Bật ZKP Balance Proof](#38--bắt-buộc-bật-zkp-balance-proof) **⚠️ BẮT BUỘC**
   - [3.9: PQC Signature Storage On-Chain](#39-pqc-signature-storage-on-chain-khuyến-nghị)
7. [Bước 4: Khởi động Web GUI](#bước-4-khởi-động-web-gui)
8. [Bước 5: Benchmark với Lacchain Ethereum-Benchmark](#bước-5-benchmark-với-lacchain-ethereum-benchmark) **⭐ MỚI**

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

**Lưu ý:** Blockchain chạy với TLS 1.3 (HTTPS) trên port 8545 và 21001-21004.

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

```bash
curl --cacert config/tls/ca/certs/sbv-root-ca.crt \
  --tlsv1.3 \
  -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  | python3 -c "import sys, json; print('Block number:', int(json.load(sys.stdin)['result'], 16))"
```

### 2.3. Kiểm tra consensus đang hoạt động

Kiểm tra validators:

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

```bash
# Workaround cho Node.js 22 với self-signed certificates
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/public/deploy_and_init.js
unset NODE_TLS_REJECT_UNAUTHORIZED
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

**💡 Lưu ý về `init_contract.js`:**
- Script tự động đọc contract address từ:
  1. Environment variable `CONTRACT_ADDRESS` (ưu tiên cao nhất)
  2. File `contracts/InterbankTransfer.address.txt` (nếu env var không có)
  3. Fallback address cũ (backward compatibility)
- Script tự động hỗ trợ HTTPS khi dùng `https://` endpoint
- Script kiểm tra PKI enabled status và hiển thị warning nếu cần
- Script hiển thị contract address đang sử dụng để debug

#### 3.4.5. Kiểm tra InterbankTransfer đã deploy

Kiểm tra contract address trong GUI config:

```bash
cat ../../GUI/web/config/contracts.ts | grep INTERBANK_TRANSFER_ADDRESS
```

Hoặc kiểm tra trực tiếp trên blockchain:

```bash
# Từ thư mục smart_contracts, dùng đường dẫn tương đối
# Thay CONTRACT_ADDRESS bằng address thực tế
curl --cacert ../config/tls/ca/certs/sbv-root-ca.crt --tlsv1.3 \
  -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{
    "jsonrpc":"2.0",
    "method":"eth_getCode",
    "params":["CONTRACT_ADDRESS", "latest"],
    "id":1
  }'

# Hoặc từ thư mục Besu-hyperledger:
cd ..
curl --cacert config/tls/ca/certs/sbv-root-ca.crt --tlsv1.3 \
  -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{
    "jsonrpc":"2.0",
    "method":"eth_getCode",
    "params":["CONTRACT_ADDRESS", "latest"],
    "id":1
  }'
```

Nếu có code (không phải "0x"), contract đã được deploy! ✅

### 3.5. Deploy PKI Registry

> **⚠️ QUAN TRỌNG:** Bước này **PHẢI** được thực hiện **SAU KHI**:
> - ✅ Blockchain đã khởi động và sẵn sàng (Bước 1 & 2)
> - ✅ InterbankTransfer contract đã được deploy (Bước 3.1-3.4)

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

# Deploy PKI Registry
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/deploy_pki.js
unset NODE_TLS_REJECT_UNAUTHORIZED
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

**⚠️ QUAN TRỌNG:** Script `deploy_pki.js` chỉ đăng ký 2 test users. Để đăng ký **TẤT CẢ** users (6 users từ GUI), cần:

**Bước 1: Fund users với native ETH (để trả gas fee)**

```bash
# Cấp 1 ETH cho mỗi user để trả gas fee khi đăng ký
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/fund_users_for_pki.js
unset NODE_TLS_REJECT_UNAUTHORIZED
```

**Bước 2: Đăng ký tất cả users vào PKI Registry**

```bash
# Đăng ký 6 users (VCB User 1, VCB User 2, VTB User 1, VTB User 2, BIDV User 1, BIDV User 2)
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/register_all_users_pki.js
unset NODE_TLS_REJECT_UNAUTHORIZED
```

Script `register_all_users_pki.js` sẽ:
- ✅ Đăng ký 6 users (tự đăng ký với PQC public key)
- ✅ Verify KYC cho mỗi user (bởi bank tương ứng)
- ✅ Set authorization với daily limit 100 ETH

**Nếu gặp lỗi "User not registered" trong GUI:**
→ Chạy cả 2 scripts: `fund_users_for_pki.js` → `register_all_users_pki.js`

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

### 3.6. Link PKI to InterbankTransfer

> **⚠️ QUAN TRỌNG:** Bước này **PHẢI** được thực hiện **SAU KHI**:
> - ✅ InterbankTransfer contract đã được deploy (Bước 3.1-3.4)
> - ✅ PKI Registry contract đã được deploy (Bước 3.5)

**⭐ Bước quan trọng:** Kết nối PKI vào InterbankTransfer

```bash
# Link contracts
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/link_pki_interbank.js
unset NODE_TLS_REJECT_UNAUTHORIZED
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

export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/test_pki.js
unset NODE_TLS_REJECT_UNAUTHORIZED
```

**Key tests:**
- ✅ Get User Info (address, key hash, registration date)
- ✅ Check KYC Validity
- ✅ Check Transfer Permission (with daily limits)
- ✅ Get PQC Public Key
- ✅ Record Transfer Usage
- ✅ Key Rotation

**Chi tiết:** Xem [PKI_INTEGRATION_GUIDE.md](../deployment/PKI_INTEGRATION_GUIDE.md)

### 3.7. Verify All Contracts

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

### 3.8. ⚠️ BẮT BUỘC: Bật ZKP Balance Proof

> **⚠️ QUAN TRỌNG:** ZKP Balance Proof là **BẮT BUỘC** để đảm bảo privacy và security cho hệ thống.  
> Mục tiêu: Chứng minh **balance > amount** mà không tiết lộ giá trị balance thực tế. Bước này thêm BalanceVerifier và ZKP Prover.

**📋 Kiến trúc ZKP (Off-Chain Proof Generation):**

- ✅ **Proof Generation**: Hoàn toàn **OFF-CHAIN** qua Rust Prover Service (Winterfell STARK)
  - Prover service chạy tại `http://localhost:8081` (REST API)
  - Proof được tạo **TRƯỚC KHI** gửi transaction lên blockchain
  - **Không block blockchain nodes**, không làm chậm block commit
  - Proof generation mất vài giây nhưng không ảnh hưởng đến blockchain performance
  
- ✅ **On-Chain Verification**: Chỉ verify proof hash và integrity checks
  - Contract (`BalanceVerifier.sol`) chỉ kiểm tra proof hash và public inputs
  - Không thực hiện full STARK verification on-chain (quá tốn gas)
  - Đảm bảo performance cao cho blockchain
  
**Luồng hoạt động:**
```
1. Client (GUI) → ZKP Prover API (http://localhost:8081) → Generate Proof (OFF-CHAIN)
2. Client nhận proof → Gửi transaction với proof hash lên blockchain
3. Blockchain verify proof hash (ON-CHAIN, nhanh)
4. Transaction được commit vào block
```

**Lợi ích:**
- ✅ **Performance cao**: Proof generation không block blockchain
- ✅ **Scalability**: Có thể scale prover service độc lập
- ✅ **Privacy**: Balance không bị tiết lộ trên blockchain

```bash
# 1) Start ZKP Prover (balance proof)
cd prover
cargo build --release
RUST_LOG=info ./target/release/zkp-prover &

# 2) Deploy BalanceVerifier (on-chain)
cd ../Besu-hyperledger/smart_contracts
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/deploy_balance_verifier.js

# 3) Link vào InterbankTransfer
RPC_ENDPOINT=https://localhost:21001 node scripts/set_balance_verifier.js
RPC_ENDPOINT=https://localhost:21001 node scripts/toggle_zkp.js   # enable ZKP flag
unset NODE_TLS_REJECT_UNAUTHORIZED

# 4) (GUI) đặt endpoint ZKP nếu cần
cd ../../GUI/web
echo "NEXT_PUBLIC_ZKP_PROVER_URL=http://localhost:8081" >> .env.local
```

**Kết quả mong đợi:**
- ✅ BalanceVerifier deployed và lưu address
- ✅ InterbankTransfer đã set verifier + bật `zkpEnabled`
- ✅ ZKP Prover lắng nghe `http://localhost:8081`

### 3.9. PQC Signature Storage On-Chain (Khuyến nghị)

> Mục tiêu: Lưu **PQC signature** (hoặc hash) on-chain cho từng transaction, để có thể audit/verify sau này,  
> đồng thời tránh vượt giới hạn kích thước contract (EIP‑170) bằng cách tách PQC ra contract riêng.

Thiết kế hiện tại:

- Contract `InterbankTransfer`:
  - Hàm `transferWithPQC(...)` — Chuyển tiền và (nếu có cấu hình) gọi registry để lưu PQC signature.
- Contract mới `PQCSignatureRegistry`:
  - `storePQCSignature(txId, pqcSignature, algorithm)` — Lưu chữ ký PQC on-chain cho một transaction ID.
  - `getPQCSignatureHash(txId)` — Lấy hash của PQC signature.
  - `getPQCSignature(txId)` — Lấy full signature + algorithm + hash.
  - `transactionHasPQCSignature(txId)` — Kiểm tra transaction có PQC signature không.

Workflow:

- GUI gọi `transferWithPQC(...)` trên `InterbankTransfer` (hàm nhỏ, chỉ xử lý business logic + emit event).
- `InterbankTransfer` sau khi thực hiện transfer sẽ:
  - Tăng `transactionCounter` để sinh `txId` (chỉ dùng cho event, **không còn lưu mảng transactions** để tiết kiệm gas).
  - Gọi `PQCSignatureRegistry.storePQCSignature(txId, signature, algorithm)` để lưu signature on-chain.
- `PQCSignatureRegistry` lưu signature và cho phép truy vấn bằng `txId`:
  - `getPQCSignatureHash(txId)` — Lấy hash của PQC signature.
  - `getPQCSignature(txId)` — Lấy full signature + algorithm + hash.
  - `transactionHasPQCSignature(txId)` — Kiểm tra transaction có PQC signature không.

#### 3.9.1. Triển khai PQCSignatureRegistry (nếu cần)

```bash
cd Besu-hyperledger/smart_contracts

# Re-compile contracts
node scripts/compile.js

# (Tuỳ chọn) Deploy PQCSignatureRegistry bằng Remix/Hardhat/Script riêng
# Sau đó gọi setPQCRegistry(...) trên InterbankTransfer để link registry
```

#### 3.9.2. Sử dụng PQC signature từ GUI

GUI đã có sẵn helper `transferWithPQC` trong `GUI/web/lib/contract.ts`:

```typescript
import { transferWithPQC } from '@/lib/contract';

// Ví dụ: chuyển 1.000.000 VND với PQC signature được lưu on-chain
const result = await transferWithPQC(
  fromPrivateKey,
  toAddress,
  1_000_000,   // amountVND
  'VCB',       // toBankCode
  'Thanh toán liên ngân hàng', // description
  true,        // usePQC
  'vietcombank'// entityId trong KSM (optional)
);

console.log('TX hash:', result.txHash, 'TX ID:', result.txId.toString());
```

**Flow:**
- GUI gọi `transferWithPQC()`.
- GUI gọi KSM để `sign()` message → nhận PQC signature (Dilithium3).
- GUI gửi signature vào `transferWithPQC(...)`.
- `InterbankTransfer` xử lý business logic và gọi `PQCSignatureRegistry.storePQCSignature(txId, signature, algorithm)`.

#### 3.9.3. Truy vấn PQC signature từ on-chain (PQCSignatureRegistry)

Ví dụ dùng script/web3:

```javascript
const hash = await pqcRegistry.getPQCSignatureHash(txId);
const [signature, algorithm, storedHash] = await pqcRegistry.getPQCSignature(txId);
const hasPQC = await pqcRegistry.transactionHasPQCSignature(txId);
```

**Use case:**
- Audit giao dịch sau này
- Đối chiếu signature off-chain
- Chuẩn bị cho ZKP nâng cao (DILITHIUM proof)

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
export const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://localhost:21001';
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

### 4.6. Accept TLS Certificate (BẮT BUỘC)

**⚠️ QUAN TRỌNG:** Do sử dụng self-signed certificate, trình duyệt sẽ từ chối kết nối HTTPS. Bạn **PHẢI** chấp nhận certificate trước khi sử dụng GUI.

**Cách 1: Accept trong browser** (Nhanh nhất - Khuyên dùng)

1. **Mở trình duyệt và truy cập:**
   ```
   https://localhost:21001
   ```

2. **Chấp nhận cảnh báo bảo mật:**
   - **Chrome/Edge:** "Your connection is not private" → Click **"Advanced"** → **"Proceed to localhost (unsafe)"**
   - **Firefox:** "Warning: Potential Security Risk Ahead" → Click **"Advanced"** → **"Accept the Risk and Continue"**
   - **Safari:** "This Connection Is Not Private" → Click **"Show Details"** → **"visit this website"**

3. **Quay lại GUI và refresh:**
   - Truy cập: `http://localhost:3000`
   - Nhấn `F5` hoặc `Ctrl+R` để refresh

**✅ Hoàn thành!** Trình duyệt đã tin cậy certificate cho session này.

**Cách 2: Import CA certificate vào hệ thống** (Một lần, lâu dài)

**Linux (Ubuntu/Debian):**
```bash
# Import SBV Root CA vào system trust store
sudo cp Besu-hyperledger/config/tls/ca/certs/sbv-root-ca.crt \
  /usr/local/share/ca-certificates/sbv-interbank.crt
sudo update-ca-certificates

# Đóng hoàn toàn tất cả cửa sổ trình duyệt và mở lại
```

**macOS:**
```bash
# Import vào Keychain
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain \
  Besu-hyperledger/config/tls/ca/certs/sbv-root-ca.crt

# Restart browser
```

**Windows:**
```powershell
# Import certificate vào Windows Certificate Store
certutil -addstore -f "ROOT" Besu-hyperledger\config\tls\ca\certs\sbv-root-ca.crt

# Restart browser
```

**Lưu ý:**
- Cách 1: Nhanh nhưng cần làm lại sau mỗi lần restart browser
- Cách 2: Một lần, hoạt động lâu dài, không cần làm lại

**Kiểm tra đã chấp nhận certificate:**
Mở browser console (F12) và chạy:
```javascript
fetch('https://localhost:21001', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'eth_blockNumber',
    params: [],
    id: 1
  })
})
.then(r => r.json())
.then(d => console.log('✅ Success:', d))
.catch(e => console.error('❌ Error:', e))
```

Nếu thấy `✅ Success: {jsonrpc: "2.0", id: 1, result: "0x..."}` → Certificate đã được chấp nhận!

### 4.7. Chọn ngân hàng và user

1. Chọn ngân hàng từ dropdown (Vietcombank, Vietinbank, BIDV)
2. Chọn user (User 1 hoặc User 2)
3. Kiểm tra số dư hiển thị đúng (100,000,000 VND = 100 ETH)

---

## Bước 5: Benchmark với Lacchain Ethereum-Benchmark

> **⭐ MỚI:** Sử dụng Lacchain Ethereum-Benchmark để đo hiệu năng (TPS, latency) của hệ thống InterbankTransfer.

### 5.1. Giới thiệu Lacchain Ethereum-Benchmark

**Lacchain Ethereum-Benchmark** là công cụ open-source được thiết kế đặc biệt cho Hyperledger Besu để:
- ✅ Đo **TPS (Transactions Per Second)**
- ✅ Đo **Latency** (thời gian phản hồi)
- ✅ **Stress test** blockchain network
- ✅ Tự động gửi transactions ở tốc độ cố định
- ✅ Lưu kết quả vào log files để phân tích

**Ưu điểm:**
- ✅ Dễ setup (có Docker Compose sẵn)
- ✅ Phù hợp với Besu
- ✅ Tự động quản lý nonce
- ✅ Hỗ trợ HTTPS với TLS

### 5.2. Setup Lacchain Benchmark

**Lacchain đã được clone và cấu hình sẵn trong project:**

```bash
cd ethereum-benchmark
```

**Cấu trúc:**
- `docker-compose.interbank.yml` - Config cho InterbankTransfer
- `RUN_BENCHMARK.sh` - Script tự động chạy benchmark
- `server/` - Code benchmark server
- `server/logs/` - Kết quả benchmark

### 5.3. Chuẩn bị trước khi benchmark

**⚠️ QUAN TRỌNG:** Trước khi chạy benchmark, cần:

1. **Blockchain đang chạy:**
   ```bash
   cd Besu-hyperledger
   docker ps | grep besu
   ```

2. **Contract đã deploy:**
   ```bash
   cat smart_contracts/contracts/InterbankTransfer.address.txt
   ```

3. **Tắt PKI/ZKP (khuyến nghị):**
   ```bash
   cd smart_contracts
   export NODE_TLS_REJECT_UNAUTHORIZED=0
   RPC_ENDPOINT=https://localhost:21001 node scripts/public/toggle_pki.js false
   RPC_ENDPOINT=https://localhost:21001 node scripts/toggle_zkp.js false
   unset NODE_TLS_REJECT_UNAUTHORIZED
   ```
   
   **Lý do:** PKI/ZKP sẽ làm chậm transactions và ảnh hưởng đến kết quả benchmark.

4. **Fund accounts cho benchmark (BẮT BUỘC cho multi-user benchmark):**
   
   **⭐ MỚI:** Để chạy benchmark với nhiều users (10+ TPS), cần fund nhiều accounts trước:
   
   ```bash
   cd ethereum-benchmark
   ./prepare-benchmark.sh 100 10
   ```
   
   **Script này sẽ:**
   - ✅ Kiểm tra blockchain đang chạy
   - ✅ Kiểm tra contract address
   - ✅ Cài đặt dependencies nếu cần
   - ✅ Fund 100 accounts với 10 ETH mỗi account
   - ✅ Tổng cần: 1000 ETH từ owner account
   
   **Tham số:**
   - `100` - Số lượng accounts cần fund
   - `10` - Số ETH mỗi account
   
   **Lưu ý:**
   - Owner account cần có đủ ETH (≥1000 ETH cho 100 accounts)
   - Có thể giảm số accounts nếu không đủ ETH: `./prepare-benchmark.sh 50 10`
   - Script chỉ cần chạy 1 lần, accounts sẽ được fund và sẵn sàng cho các lần benchmark sau
   
   **Lacchain tự động:**
   - Generate random accounts cho mỗi transaction
   - Mỗi transaction sẽ dùng một account khác nhau
   - Tự động quản lý nonce cho mỗi account

### 5.4. Chạy Benchmark

**Cách 1: Sử dụng script tự động (Khuyên dùng)**

**Benchmark cơ bản (1 TPS):**
```bash
cd ethereum-benchmark

# Chạy benchmark với TPS mặc định (1 tx/s) trong 1 phút
./RUN_BENCHMARK.sh

# Hoặc chỉ định TPS và thời gian
./RUN_BENCHMARK.sh 5 2  # 5 TPS trong 2 phút
```

**⭐ Benchmark với nhiều users (10+ TPS):**

**Bước 1: Fund accounts (chỉ cần làm 1 lần)**
```bash
cd ethereum-benchmark
./prepare-benchmark.sh 100 10
```
→ Fund 100 accounts với 10 ETH mỗi account

**Bước 2: Chạy benchmark 10 TPS**
```bash
./RUN_BENCHMARK.sh 10 2
```
→ 10 TPS trong 2 phút (~1200 transactions)
→ Mỗi transaction dùng một account khác nhau

**Kết quả mong đợi:**
- TPS: ~10 tx/s
- Success rate: 100% (nếu accounts đã được fund)
- Latency: 10-15 giây (do QBFT consensus)
- Số transactions: ~1200 transactions trong 2 phút

**Cách 2: Sử dụng Docker Compose trực tiếp**

```bash
cd ethereum-benchmark

# Sửa contract address trong docker-compose.interbank.yml nếu cần
# Sau đó chạy:
docker-compose -f docker-compose.interbank.yml up --build
```

### 5.5. Cấu hình Benchmark

**File:** `docker-compose.interbank.yml`

**Các tham số quan trọng:**

```yaml
environment:
  - DESIRED_RATE_TX=1          # TPS (transactions per second)
  - TEST_TIME_MINUTES=1        # Thời gian test (phút)
  - RPC_URL=https://localhost:21001  # Besu RPC endpoint
  - MAX_GAS_PER_TX=300000      # Gas limit cho mỗi transaction
  - INTERBANK_CONTRACT_ADDRESS=0x...  # Contract address
  - TO_ADDRESS=0x...           # Địa chỉ nhận
  - AMOUNT_WEI=1000000000000000  # Số tiền chuyển (wei)
  - TO_BANK_CODE=VCB           # Mã ngân hàng nhận
```

**Khuyến nghị:**
- **TPS thấp (1-5):** Để test ổn định, không gây nghẽn, không cần fund accounts
- **TPS trung bình (10-20):** Để test hiệu năng thực tế, **CẦN fund accounts trước** (`./prepare-benchmark.sh`)
- **TPS cao (50+):** Để stress test, có thể gây nonce issues, cần fund nhiều accounts hơn

**⭐ Multi-User Benchmark:**
- Lacchain tự động generate random accounts cho mỗi transaction
- Mỗi transaction dùng một account khác nhau → tránh nonce congestion
- Cần fund accounts trước khi chạy benchmark 10+ TPS
- Script tự động quản lý nonce cho mỗi account

### 5.6. Xem kết quả Benchmark

**Kết quả được lưu trong:** `server/logs/`

**Các file log:**
- `*-stimulus` - Thời gian gửi transactions
- `*-response` - Thời gian nhận receipts

**Xem kết quả:**

```bash
cd ethereum-benchmark/server/logs
ls -lh

# Xem nội dung log
cat *-response | head -20
```

**Format log:**
```
timestamp_ms,transaction_number
1234567890,1
1234567891,2
...
```

**Phân tích kết quả:**

1. **TPS thực tế:**
   ```bash
   # Đếm số transactions trong log
   wc -l *-response
   ```

2. **Latency trung bình:**
   - Tính chênh lệch giữa `stimulus` và `response`
   - Latency = response_time - stimulus_time

3. **Success rate:**
   - So sánh số transactions gửi vs số receipts nhận được

### 5.7. Troubleshooting Benchmark

**Lỗi: "Transaction nonce is too distant"**
- **Nguyên nhân:** TPS quá cao, nonce không kịp sync
- **Giải pháp:** Giảm `DESIRED_RATE_TX` xuống 1-5 TPS

**Lỗi: "execution reverted"**
- **Nguyên nhân:** PKI/ZKP enabled hoặc account không đủ balance
- **Giải pháp:** 
  - Tắt PKI/ZKP: `node scripts/public/toggle_pki.js false`
  - Fund accounts: `./prepare-benchmark.sh 100 10`

**Lỗi: "insufficient funds" hoặc "out of gas"**
- **Nguyên nhân:** Accounts chưa được fund với ETH
- **Giải pháp:** Chạy `./prepare-benchmark.sh` để fund accounts trước khi benchmark

**Lỗi: "Connection refused"**
- **Nguyên nhân:** Blockchain chưa chạy hoặc RPC URL sai
- **Giải pháp:** Kiểm tra `docker ps` và `RPC_URL` trong docker-compose

**Lỗi: "Certificate verification failed"**
- **Nguyên nhân:** Self-signed certificate không được chấp nhận
- **Giải pháp:** Đảm bảo `NODE_TLS_REJECT_UNAUTHORIZED=0` trong docker-compose

### 5.8. Best Practices

1. **Bắt đầu với TPS thấp:**
   - Bắt đầu với 1 TPS trong 1 phút
   - Tăng dần nếu hệ thống ổn định
   - Không cần fund accounts cho TPS thấp (1-5)

2. **Fund accounts cho benchmark cao (10+ TPS):**
   - Chạy `./prepare-benchmark.sh 100 10` trước khi benchmark
   - Đảm bảo owner account có đủ ETH (≥1000 ETH cho 100 accounts)
   - Có thể giảm số accounts nếu không đủ ETH

3. **Tắt PKI/ZKP khi benchmark:**
   - PKI/ZKP sẽ làm chậm transactions
   - Benchmark để đo hiệu năng blockchain, không phải security features

4. **Monitor blockchain trong khi benchmark:**
   ```bash
   # Xem logs của Besu nodes
   docker logs besu-hyperledger-sbv-1 --tail 50 -f
   ```

5. **Chạy nhiều lần để có kết quả chính xác:**
   - Chạy benchmark 3-5 lần với cùng config
   - Lấy giá trị trung bình

6. **Lưu kết quả:**
   - Backup log files sau mỗi lần benchmark
   - Ghi chú config đã dùng (TPS, thời gian, PKI/ZKP status, số accounts)

7. **Multi-User Benchmark:**
   - Sử dụng nhiều accounts để tránh nonce congestion
   - Lacchain tự động generate và quản lý accounts
   - Mỗi transaction dùng một account khác nhau → hiệu năng cao hơn

### 5.9. So sánh với Caliper

**Lacchain vs Caliper:**

| **Tiêu chí** | **Lacchain** | **Caliper** |
|-------------|-------------|-------------|
| Setup | ⭐⭐⭐ Dễ (5-10 phút) | ⭐⭐ Trung bình (15-30 phút) |
| Besu Support | ✅✅✅ Rất tốt | ✅✅ Tốt |
| Docker Support | ✅ Có sẵn | ⚠️ Cần config |
| Nonce Management | ✅ Tự động | ⚠️ Cần config |
| TPS Measurement | ✅ Tự động | ✅ Tự động |
| Latency Measurement | ✅ Tự động | ✅ Tự động |
| Report Generation | ✅ Log files | ✅ HTML report |
| Multi-Account | ✅ Hỗ trợ | ✅ Hỗ trợ |

**Kết luận:** Lacchain phù hợp hơn cho Besu, dễ setup và ít lỗi nonce hơn Caliper.

---

## 📝 Lưu ý quan trọng

1. **Thứ tự thực hiện:** 
   - TLS Setup (0A) → PQC/KSM Setup (0B) → **Blockchain (1)** → Deploy InterbankTransfer (3.1-3.4) → **Deploy PKI Registry (3.5)** → Link PKI (3.6) → **Deploy ZKP Balance Proof (3.8)** ⚠️ → Web GUI (4) → **Benchmark (5)** ⭐
   - **⚠️ QUAN TRỌNG:** 
     - Blockchain **PHẢI** chạy trước khi deploy bất kỳ contract nào (bao gồm PKI Registry và ZKP)!
     - ZKP Balance Proof là **BẮT BUỘC** để đảm bảo privacy và security!
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
8. **⚠️ ZKP Balance Proof (BẮT BUỘC):**
   - **⚠️ QUAN TRỌNG:** ZKP là bắt buộc để đảm bảo privacy và security
   - Start prover: `cd prover && cargo build --release && RUST_LOG=info ./target/release/zkp-prover &`
   - Deploy verifier: `RPC_ENDPOINT=https://localhost:21001 node scripts/deploy_balance_verifier.js`
   - Link & enable: `node scripts/set_balance_verifier.js`, `node scripts/toggle_zkp.js`
   - GUI endpoint: set `NEXT_PUBLIC_ZKP_PROVER_URL=http://localhost:8081`
   - **Chi tiết:** Xem [ZKP_IMPLEMENTATION.md](../../ZKP_IMPLEMENTATION.md)
9. **PKI Registry:**
   - **⚠️ Thứ tự quan trọng:** PKI Registry **PHẢI** được deploy **SAU KHI** blockchain đã chạy và InterbankTransfer đã được deploy
   - Deploy PKI: `node scripts/deploy_pki.js` (sau Bước 1 & 2)
   - Link PKI: `node scripts/link_pki_interbank.js` (sau khi cả 2 contracts đã deploy)
   - Test PKI: `node scripts/test_pki.js` (optional, để verify)
   - **Chi tiết:** Xem [PKI_INTEGRATION_GUIDE.md](../deployment/PKI_INTEGRATION_GUIDE.md)
10. **Benchmarking:**
   - Sử dụng **Lacchain Ethereum-Benchmark** để đo TPS và latency
   - Setup: `cd ethereum-benchmark && ./RUN_BENCHMARK.sh`
   - Khuyến nghị: Tắt PKI/ZKP khi benchmark để có kết quả chính xác
   - Kết quả lưu trong `server/logs/`
   - **Chi tiết:** Xem [Bước 5: Benchmark với Lacchain Ethereum-Benchmark](#bước-5-benchmark-với-lacchain-ethereum-benchmark)
11. **Bảo mật:** 
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
│  • ZKP Balance Proof ⚠️ BẮT BUỘC          │
└────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│         BLOCKCHAIN LAYER                    │
│  • 8 Besu Nodes (QBFT Consensus)           │
│  • Smart Contracts:                         │
│    - InterbankTransfer (with PKI + ZKP) ⭐ │
│    - PKIRegistry ⭐                         │
│    - BalanceVerifier ⚠️ BẮT BUỘC           │
└────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│         SERVICE LAYER                       │
│  • KSM (Port 8080) - PQC signing           │
│  • ZKP Prover (Port 8081) - Balance Proof ⚠️ BẮT BUỘC │
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
- ✅ `BalanceVerifier` - ZK proof verification (Balance > Amount) ⚠️ **BẮT BUỘC**

**Services Running:**
- ✅ 8x Besu Nodes (blockchain)
- ✅ KSM Service (PQC signing - Dilithium3)
- ✅ ZKP Prover (Balance Proof - Port 8081) ⚠️ **BẮT BUỘC**
- ✅ Monitoring tools (Blockscout, Grafana)

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
- ✅ ZKP Balance Proof (Privacy-preserving verification) ⚠️ **BẮT BUỘC**

---

**Chúc bạn thành công! 🎉**

**📚 Tài liệu tham khảo:**
- [PKI Integration Guide](../deployment/PKI_INTEGRATION_GUIDE.md) ⭐
- [ZKP Winterfell Deployment](../deployment/ZKP_WINTERFELL_DEPLOYMENT.md) ⭐
- [Quy trình triển khai PQC](../deployment/QUY_TRINH_TRIEN_KHAI_PQC.md) ⭐
- [TLS 1.3 Setup Guide](../deployment/TLS13_SETUP_GUIDE.md)

---

