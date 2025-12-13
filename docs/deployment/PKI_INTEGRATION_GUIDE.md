# PKI Integration với InterbankTransfer

## 📋 Tổng quan

Đã tích hợp **PKIRegistry** vào **InterbankTransfer** contract để thêm:
- ✅ KYC verification
- ✅ Transfer authorization
- ✅ Daily limits tracking
- ✅ PQC public key management

---

## 🔗 Contract Integration

### 1. InterbankTransfer.sol Updates

**Thêm PKI Interface:**
```solidity
interface IPKIRegistry {
    function isKYCValid(address _user) external view returns (bool);
    function canUserTransfer(address _user, uint256 _amount) external view returns (bool);
    function recordTransfer(address _user, uint256 _amount) external;
    function getUserPublicKey(address _user) external view returns (bytes memory);
}
```

**Thêm PKI State:**
```solidity
IPKIRegistry public pkiRegistry;
bool public pkiEnabled;
```

**Transfer với PKI Verification:**
```solidity
function transfer(...) public returns (uint256) {
    // PKI Verification (if enabled)
    if (pkiEnabled && address(pkiRegistry) != address(0)) {
        require(pkiRegistry.isKYCValid(msg.sender), "KYC not valid");
        require(pkiRegistry.canUserTransfer(msg.sender, amount), "Not authorized");
    }
    
    // Execute transfer...
    
    // Record in PKI
    if (pkiEnabled) {
        pkiRegistry.recordTransfer(msg.sender, amount);
    }
}
```

---

## 🚀 Deployment Steps

### Step 1: Deploy PKIRegistry

```bash
cd ~/project/NT219_Project/Besu-hyperledger/smart_contracts

# Compile
node scripts/compile.js

# Deploy PKI
RPC_ENDPOINT=https://localhost:21001 node scripts/deploy_pki.js
```

**Output:**
```
✅ Contract deployed at: 0x...
✅ SBV authorized
✅ VCB authorized
✅ VTB authorized
✅ BIDV authorized
👤 Registering test users...
✅ VCB_User_1 registered
  ✅ KYC verified
  ✅ Authorization set
```

### Step 2: Link PKI to InterbankTransfer

```bash
# Link contracts
RPC_ENDPOINT=https://localhost:21001 node scripts/link_pki_interbank.js
```

**Output:**
```
🔗 Step 1: Linking PKI Registry to InterbankTransfer...
  ✅ PKI Registry linked!
  ✅ PKI Enabled: true

📝 Step 2: Updating GUI configuration...
  ✅ GUI config updated

🧪 Step 3: Testing PKI integration...
  ✅ Test 1: PKI Enabled = true
  ✅ Test 2: getUserPublicKey exists = true
  ✅ Test 3: checkTransferAuthorization exists = true
```

### Step 3: Test Integration

```bash
# Test PKI functionality
node scripts/test_pki.js
```

---

## 🖥️ GUI Integration

### New Profile Page

**Location:** `GUI/web/app/profile/page.tsx`

**Features:**
- ✅ View user identity
- ✅ Check KYC status
- ✅ View authorization & daily limits
- ✅ Display PQC public key
- ✅ Real-time limit tracking

**Access:** `http://localhost:3000/profile`

### Navigation Updated

**New Tab:** 👤 Profile

```tsx
// Navigation items
{ href: '/profile', label: '👤 Profile', icon: '👤' }
```

---

## 📊 User Profile Features

### 1. Account Information
- Address
- Key Hash
- Registration date
- Active status

### 2. KYC Status
- Verification status
- Verified date
- Expiration date
- Verifier (bank)
- KYC Hash (privacy-preserving)

### 3. Authorization & Limits
- Transfer permission
- Receive permission
- Daily limit (total)
- Used today
- Real-time progress bar

### 4. PQC Public Key
- Dilithium3 public key display
- Quantum-resistant badge
- Key size information

---

## 🔧 Testing

### Test User Registration

```bash
# Test 1: Get User Info
curl http://localhost:8545 -X POST \
  -H "Content-Type: application/json" \
  --data '{
    "jsonrpc":"2.0",
    "method":"eth_call",
    "params":[{
      "to":"PKI_REGISTRY_ADDRESS",
      "data":"getUserInfo_SELECTOR"
    },"latest"],
    "id":1
  }'
```

### Test Transfer with PKI

```javascript
// Transfer will check:
// 1. KYC valid
// 2. Authorization
// 3. Daily limit
// 4. Record usage

const tx = await interbankContract.transfer(
  recipientAddress,
  amount,
  toBankCode,
  description
);
```

---

## 🎯 Workflow hoàn chỉnh

```
[USER REGISTRATION - Already Done]
    ↓
1. User registered in PKI
2. KYC verified by bank
3. Authorization set (daily limit: 100 ETH)
    ↓
[TRANSFER FLOW - With PKI]
    ↓
4. User creates transfer on GUI
    ↓
5. InterbankTransfer.transfer() called
    ↓
6. PKI checks:
   ✅ isKYCValid(user) → true
   ✅ canUserTransfer(user, amount) → check limit
    ↓
7. Transfer executed
    ↓
8. PKI.recordTransfer(user, amount)
    ↓
9. Daily limit updated
    ↓
[COMPLETE]
```

---

## 📌 Contract Addresses

After deployment, you'll have:

```
PKI Registry: 0x... (stored in PKIRegistry.address.txt)
InterbankTransfer: 0x... (stored in InterbankTransfer.address.txt)
```

GUI config automatically updated:
```typescript
// GUI/web/config/contracts.ts
export const PKI_REGISTRY_ADDRESS = '0x...';
export const INTERBANK_TRANSFER_ADDRESS = '0x...';
```

---

## ✅ Verification Checklist

- [ ] PKI Registry deployed
- [ ] Test users registered with KYC
- [ ] PKI linked to InterbankTransfer
- [ ] pkiEnabled = true
- [ ] GUI config updated
- [ ] Profile page accessible
- [ ] Navigation shows Profile tab
- [ ] Transfer checks KYC before execution
- [ ] Daily limits tracked correctly

---

## 🐛 Troubleshooting

### Issue: "User not registered"
```bash
# Register user first
node scripts/deploy_pki.js
```

### Issue: "PKI not enabled"
```bash
# Link PKI to InterbankTransfer
node scripts/link_pki_interbank.js
```

### Issue: "KYC not valid"
```bash
# Verify KYC (from authorized bank)
node scripts/test_pki.js
```

---

## 📚 Next Steps

1. **Test E2E Flow:**
   ```bash
   # Run full test
   npm run test:pki
   ```

2. **Deploy to Production:**
   - Update RPC_ENDPOINT
   - Use production private keys
   - Verify all banks authorized

3. **Monitor:**
   - Check daily limits reset
   - Track KYC expirations
   - Monitor transfer authorizations

---

**✅ Integration Complete!** PKI Registry now protects all interbank transfers with KYC verification and daily limits.

