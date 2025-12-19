# 🔧 Browser TLS Certificate Fix

## Problem

Browser shows: `NetworkError when attempting to fetch resource`

**Cause:** Browser rejects self-signed TLS certificate from `https://localhost:21001`

---

## Solution 1: Accept Certificate in Browser (Quickest)

### Step 1: Visit HTTPS endpoint directly

Open in your browser:
```
https://localhost:21001
```

### Step 2: Accept the security warning

You'll see a warning like:
- **Chrome/Edge:** "Your connection is not private" → Click "Advanced" → "Proceed to localhost (unsafe)"
- **Firefox:** "Warning: Potential Security Risk Ahead" → Click "Advanced" → "Accept the Risk and Continue"
- **Safari:** "This Connection Is Not Private" → Click "Show Details" → "visit this website"

### Step 3: Refresh your app

Go back to `http://localhost:3000` and refresh.

**✅ Done!** Browser now trusts the certificate for this session.

---

## Solution 2: Use HTTP Instead (Disable TLS)

If you don't need TLS for development:

### 1. Stop blockchain
```bash
cd /home/quy/project/NT219_Project/Besu-hyperledger
docker-compose down
```

### 2. Remove TLS from node configs
```bash
# Backup TLS configs
mv config/nodes/sbv/config-tls.toml config/nodes/sbv/config-tls.toml.backup
mv config/nodes/vietcombank/config-tls.toml config/nodes/vietcombank/config-tls.toml.backup
# ... (or just don't use the -tls configs)

# Start without TLS (using original config.toml)
docker-compose up -d
```

### 3. Update GUI config
```typescript
// GUI/web/config/blockchain.ts
export const RPC_ENDPOINT = 'http://localhost:21001'; // Change to HTTP
```

### 4. Restart GUI
```bash
cd /home/quy/project/NT219_Project/GUI/web
# Kill current dev server (Ctrl+C)
npm run dev
```

---

## Solution 3: Import CA Certificate to System (Best for Dev)

### Linux (Ubuntu/Debian)
```bash
# Copy CA certificate
sudo cp /home/quy/project/NT219_Project/Besu-hyperledger/config/tls/ca/certs/sbv-root-ca.crt \
  /usr/local/share/ca-certificates/sbv-root-ca.crt

# Update system trust store
sudo update-ca-certificates

# Restart browser completely (close all windows)
```

### macOS
```bash
# Import to Keychain
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain \
  /home/quy/project/NT219_Project/Besu-hyperledger/config/tls/ca/certs/sbv-root-ca.crt

# Restart browser
```

### Windows
```powershell
# Import certificate
certutil -addstore -f "ROOT" C:\path\to\sbv-root-ca.crt

# Restart browser
```

---

## Solution 4: Chrome Certificate Exception (Quick Dev)

### Chrome/Edge
1. Visit `chrome://flags/#allow-insecure-localhost`
2. Enable "Allow invalid certificates for resources loaded from localhost"
3. Restart browser
4. Refresh your app

**⚠️ Warning:** This makes ALL localhost HTTPS requests insecure!

---

## Recommended Workflow

### For Development (Quick Start)
1. Use **Solution 1** (accept certificate in browser)
2. Takes 30 seconds
3. Need to repeat after browser restart

### For Long-term Development
1. Use **Solution 3** (import CA to system)
2. One-time setup
3. Works across browser restarts

### For Simple Testing (No Security)
1. Use **Solution 2** (disable TLS, use HTTP)
2. Fastest for quick testing
3. No certificate issues

---

## Troubleshooting

### Still getting errors after accepting certificate?

**Check if you're using the correct endpoint:**
```bash
# In browser console (F12)
console.log(process.env.NEXT_PUBLIC_RPC_ENDPOINT)
# Should show: https://localhost:21001
```

**Or check config file:**
```bash
grep RPC_ENDPOINT /home/quy/project/NT219_Project/GUI/web/config/blockchain.ts
# Should show: https://localhost:21001
```

### Certificate expired or invalid?

**Regenerate certificates:**
```bash
cd /home/quy/project/NT219_Project/Besu-hyperledger
./scripts/generate_tls13_certs.sh
./scripts/generate_node_configs.sh
docker-compose down
docker-compose up -d
```

Then accept new certificate in browser (Solution 1).

---

## Quick Test

After applying fix, test in browser console (F12):
```javascript
// Test fetch to blockchain
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

**Expected output:** `✅ Success: {jsonrpc: "2.0", id: 1, result: "0x..."}`

---

## Summary

| Solution | Setup Time | Security | Persists? |
|----------|------------|----------|-----------|
| 1. Accept in browser | 30 sec | Medium | Until browser restart |
| 2. Use HTTP | 5 min | None | Yes |
| 3. Import CA cert | 2 min | High | Yes |
| 4. Chrome flag | 1 min | Low | Yes |

**Recommended:** Solution 1 for quick start, Solution 3 for long-term dev.

---

**Choose the solution that fits your workflow!**
