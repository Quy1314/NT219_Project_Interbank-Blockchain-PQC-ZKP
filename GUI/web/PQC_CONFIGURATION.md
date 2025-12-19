# 🔐 PQC Configuration Guide

## Overview

**Post-Quantum Cryptography (PQC) is ENABLED by default** in this GUI to provide quantum-resistant security for all transactions.

## Default Settings

### PQC Status: ✅ ENABLED

All transactions will be signed using:
- **Algorithm:** Dilithium3 (NIST Level 3 security)
- **Signature Size:** ~3.3KB
- **Performance:** ~2ms signing time

### KSM Service

- **URL:** `http://localhost:8080`
- **Health Check:** Every 30 seconds
- **Timeout:** 10 seconds

## Configuration Options

### Option 1: Environment Variables

Create `.env.local` file (not tracked by git):

```bash
# Disable PQC (not recommended)
NEXT_PUBLIC_PQC_ENABLED=false

# Custom KSM URL
NEXT_PUBLIC_KSM_URL=http://custom-ksm-server:8080
```

### Option 2: Browser Console

```javascript
// Check PQC status
import { getPQCEnabled } from '@/config/pqc';
console.log('PQC Enabled:', getPQCEnabled());

// Disable PQC (temporary, for current session)
import { setPQCEnabled } from '@/config/pqc';
setPQCEnabled(false);

// Re-enable PQC
setPQCEnabled(true);
```

### Option 3: Code Configuration

Edit `config/pqc.ts`:

```typescript
// Change default
export const PQC_ENABLED_DEFAULT = false; // Disable by default
```

## Usage in Components

### Basic Usage

```typescript
import { usePQC } from '@/lib/usePQC';

function TransferComponent() {
  const { isKSMReady, signTransaction, error } = usePQC();
  
  // Check if PQC is available
  if (!isKSMReady) {
    return <div>⚠️ PQC not available</div>;
  }
  
  // Sign transaction
  const handleTransfer = async () => {
    try {
      const signature = await signTransaction(
        'vietcombank',
        'vietinbank',
        1000000,
        'Payment'
      );
      console.log('Signed with PQC:', signature);
    } catch (err) {
      console.error('PQC signing failed:', err);
    }
  };
  
  return <button onClick={handleTransfer}>Transfer</button>;
}
```

### Check PQC Status

```typescript
import { getPQCEnabled } from '@/config/pqc';

function StatusComponent() {
  const isPQCEnabled = getPQCEnabled();
  
  return (
    <div>
      {isPQCEnabled ? (
        <span>🔒 Quantum-Resistant</span>
      ) : (
        <span>⚠️ Standard Crypto</span>
      )}
    </div>
  );
}
```

## KSM Service Setup

### Start KSM Service

```bash
cd Besu-hyperledger
docker-compose build ksm
docker-compose up -d ksm
```

### Verify KSM is Running

```bash
# Health check
curl http://localhost:8080/ksm/health

# Expected response:
{
  "status": "UP",
  "service": "KSM - Key Simulation Module",
  "version": "1.0.0",
  "algorithms": ["DILITHIUM2", "DILITHIUM3", "DILITHIUM5", ...],
  "defaultSignature": "DILITHIUM3"
}
```

### Generate Keys for Banks

```bash
# Generate keys for all banks
for bank in vietcombank vietinbank bidv agribank techcombank mbbank; do
  curl -X POST http://localhost:8080/ksm/generateKey \
    -H "Content-Type: application/json" \
    -d "{\"entityId\":\"$bank\"}"
done
```

## Troubleshooting

### PQC Not Working

**Symptom:** Transactions fail or show "KSM not available"

**Solutions:**

1. **Check KSM service is running:**
   ```bash
   docker ps | grep ksm-service
   docker logs ksm-service
   ```

2. **Check KSM health:**
   ```bash
   curl http://localhost:8080/ksm/health
   ```

3. **Restart KSM:**
   ```bash
   docker-compose restart ksm
   ```

4. **Check browser console:**
   - Open DevTools (F12)
   - Look for `[usePQC]` or `[KSM Client]` messages

### Keys Not Generated

**Symptom:** "Key pair not found for entity"

**Solution:**

```bash
# Generate key for specific bank
curl -X POST http://localhost:8080/ksm/generateKey \
  -H "Content-Type: application/json" \
  -d '{"entityId":"vietcombank","algorithm":"Dilithium3"}'
```

### Slow Performance

**Symptom:** Transactions take longer than expected

**Explanation:**
- PQC signatures are larger (~3.3KB vs ~65 bytes)
- Signing takes ~2ms (vs <1ms for ECDSA)
- This is **acceptable** for interbank transactions

**To disable PQC temporarily:**
```javascript
// In browser console
localStorage.setItem('pqc_enabled', 'false');
location.reload();
```

## Security Considerations

### Why PQC is Enabled by Default

1. **Quantum Threat:** Protect against future quantum computers
2. **Long-term Security:** Financial transactions need decades of security
3. **Compliance:** Meet NT219 project requirements (Track A - Section 5.1)

### When to Disable PQC

⚠️ **Not recommended**, but you may disable PQC if:
- Testing performance without PQC overhead
- KSM service is unavailable
- Development/debugging standard crypto flow

### Migration Path

Current implementation uses **mock PQC** for demonstration.

**For production:**
1. Replace mock with real library (BouncyCastle or OQS)
2. Store keys in HSM (not in-memory)
3. Implement key rotation
4. Add signature verification in smart contracts

## Configuration Reference

### File: `config/pqc.ts`

```typescript
// Feature flag
export const PQC_ENABLED_DEFAULT = true; // ✅ ENABLED

// KSM Service
export const KSM_SERVICE_URL = 'http://localhost:8080';
export const KSM_TIMEOUT = 10000; // 10 seconds

// Algorithms
export const DEFAULT_SIGNATURE_ALGORITHM = 'Dilithium3';
export const DEFAULT_ENCRYPTION_ALGORITHM = 'Kyber768';

// Auto-generate keys
export const AUTO_GENERATE_KEYS = true;
export const PRELOAD_ENTITIES = [
  'vietcombank',
  'vietinbank',
  'bidv',
  'agribank',
  'techcombank',
  'mbbank'
];

// UI
export const SHOW_PQC_STATUS = true;
export const SHOW_SIGNATURE_DETAILS = false; // Debug only
```

## API Reference

### `usePQC()` Hook

```typescript
const {
  isKSMReady,      // boolean: KSM service available
  isLoading,       // boolean: Operation in progress
  error,           // string | null: Last error
  generateKey,     // (entityId: string) => Promise<void>
  signTransaction, // (from, to, amount, desc) => Promise<PQCSignature>
  verifySignature, // (entityId, message, sig) => Promise<boolean>
  createSignedTransaction, // (from, to, amount, desc) => Promise<SignedTransaction>
  checkHealth,     // () => Promise<boolean>
  clearError       // () => void
} = usePQC();
```

### Configuration Functions

```typescript
import { 
  getPQCEnabled,   // () => boolean
  setPQCEnabled,   // (enabled: boolean) => void
  logPQC          // (message: string, data?: any) => void
} from '@/config/pqc';
```

## Performance Metrics

| Metric | Standard Crypto | PQC (Dilithium3) |
|--------|----------------|------------------|
| Signature Size | ~65 bytes | ~3,309 bytes |
| Signing Time | <1ms | ~2ms |
| Verification Time | <1ms | ~1ms |
| Key Size (Public) | 33 bytes | 1,952 bytes |
| Security Level | ECDSA-256 | NIST Level 3 (Quantum-Safe) |

**Impact on TPS:**
- Standard: ~100 TPS
- With PQC: ~80-90 TPS
- **Acceptable** for interbank use case

## Next Steps

1. ✅ **PQC is already enabled** - no action needed
2. ✅ Start KSM service: `docker-compose up -d ksm`
3. ✅ Generate keys for banks (see above)
4. ✅ Test transactions in GUI
5. ⏳ Monitor performance
6. ⏳ Replace mock PQC with real library (production)

---

**For more details, see:**
- [RUNBOOK.md](../../docs/guides/RUNBOOK.md) - Section 0B: PQC/KSM Setup
- [PQC_KSM_INTEGRATION_SUMMARY.md](../../PQC_KSM_INTEGRATION_SUMMARY.md)
- [NT219_BaoCaoTienDo-2.pdf](../../docs/reference/NT219_BaoCaoTienDo-2.pdf) - Section 5.1
