# 🔐 TLS Commands Cheat Sheet

## Quick Reference: HTTP vs HTTPS

**⚠️ Quan trọng:** Khi blockchain chạy với TLS, node **CHỈ ACCEPT HTTPS**, không accept HTTP!

| Scenario | Endpoint | Example |
|----------|----------|---------|
| **With TLS** | `https://localhost:21001` | `curl -k --tlsv1.3 -X POST https://localhost:21001 ...` |
| **Without TLS** | `http://localhost:21001` | `curl -X POST http://localhost:21001 ...` |

---

## Check if TLS is enabled

```bash
docker logs besu-hyperledger-sbv-1 2>&1 | grep "TLS enabled"

# If you see: "JSON-RPC service started ... with TLS enabled"
# → Use HTTPS
```

---

## curl Commands with TLS

### Option 1: Secure (với CA certificate)

```bash
curl --cacert config/tls/ca/certs/sbv-root-ca.crt --tlsv1.3 \
  -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### Option 2: Quick test (insecure - skip cert verification)

```bash
curl -k --tlsv1.3 \
  -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

**Note:** `-k` = `--insecure` (skip certificate verification)

---

## Node.js Scripts with TLS

### Deploy Contract

```bash
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/public/deploy_and_init.js
unset NODE_TLS_REJECT_UNAUTHORIZED
```

### Check Balance

```bash
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node scripts/public/check_balance.js
unset NODE_TLS_REJECT_UNAUTHORIZED
```

### Any Script

```bash
export NODE_TLS_REJECT_UNAUTHORIZED=0
RPC_ENDPOINT=https://localhost:21001 node your_script.js
unset NODE_TLS_REJECT_UNAUTHORIZED
```

---

## Test Scripts

### Test TLS Connection (Node.js)

```bash
cd smart_contracts
NODE_TLS_REJECT_UNAUTHORIZED=0 RPC_ENDPOINT=https://localhost:21001 \
  node scripts/test_tls_connection.js
```

### Test Blockchain TLS Setup (Shell)

```bash
cd Besu-hyperledger
./scripts/test_tls.sh
```

### Test KSM Service

```bash
curl http://localhost:8080/ksm/health
```

---

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Empty reply from server` | Using HTTP when TLS enabled | Use `https://` instead of `http://` |
| `self-signed certificate` | Node.js strict validation | Set `NODE_TLS_REJECT_UNAUTHORIZED=0` |
| `Connection refused` | Node not running | `docker-compose up -d` |
| `certificate verify failed` | CA cert not found | Use `-k` or `--cacert path/to/ca.crt` |

---

## Examples

### Get Block Number

**With TLS:**
```bash
curl -k --tlsv1.3 -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

**Without TLS:**
```bash
curl -X POST http://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### Get Validators

**With TLS:**
```bash
curl -k --tlsv1.3 -X POST https://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"qbft_getValidatorsByBlockNumber","params":["latest"],"id":1}' \
  | python3 -m json.tool
```

**Without TLS:**
```bash
curl -X POST http://localhost:21001 \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"qbft_getValidatorsByBlockNumber","params":["latest"],"id":1}' \
  | python3 -m json.tool
```

---

## Security Notes

### Development Workarounds

⚠️ **These are for development only:**

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0  # Disable cert verification in Node.js
curl -k                          # Skip cert verification in curl
```

### Production

**Don't use workarounds!** Instead:

1. **Use proper CA-signed certificates**
2. **Import self-signed CA to system trust store:**
   ```bash
   sudo cp config/tls/ca/certs/sbv-root-ca.crt /usr/local/share/ca-certificates/
   sudo update-ca-certificates
   ```
3. **Use axios with explicit CA certificate** (better than fetch)

---

## Environment Variables

```bash
# RPC Endpoint
RPC_ENDPOINT=https://localhost:21001  # With TLS
RPC_ENDPOINT=http://localhost:21001   # Without TLS

# CA Certificate Path
CA_CERT_PATH=/path/to/sbv-root-ca.crt

# Allow insecure TLS (development only)
ALLOW_INSECURE_TLS=true

# Node.js TLS workaround (development only)
NODE_TLS_REJECT_UNAUTHORIZED=0
```

---

## Troubleshooting Workflow

```
1. Check if node is running:
   docker ps | grep besu

2. Check if TLS is enabled:
   docker logs besu-hyperledger-sbv-1 | grep "TLS enabled"

3. If TLS enabled:
   → Use https://localhost:21001
   → Use curl -k or --cacert
   → Use NODE_TLS_REJECT_UNAUTHORIZED=0 for Node.js

4. If TLS not enabled:
   → Use http://localhost:21001
   → No special flags needed
```

---

**See also:**
- [RUNBOOK.md](./RUNBOOK.md) - Complete guide
- [DEPLOY_WITH_TLS.md](../../Besu-hyperledger/smart_contracts/DEPLOY_WITH_TLS.md) - Deploy guide
- [TLS13_SETUP_GUIDE.md](../deployment/TLS13_SETUP_GUIDE.md) - TLS setup

