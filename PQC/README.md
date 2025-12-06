# Module PQC (Post-Quantum Cryptography) - Java Implementation

## 📋 Tổng quan

Module này cung cấp implementation các thuật toán mật mã hậu lượng tử (PQC) bằng Java, được thiết kế để tích hợp vào hệ thống blockchain của dự án NT219.

## 🎯 Các thuật toán được hỗ trợ

### 1. **Dilithium** - Chữ ký số hậu lượng tử
- **Dilithium2**: Mức bảo mật Level 2
- **Dilithium3**: Mức bảo mật Level 3 (khuyến nghị)
- **Dilithium5**: Mức bảo mật Level 5

**Ứng dụng**: Ký và xác thực transactions, messages

### 2. **Kyber** - Mã hóa khóa công khai hậu lượng tử
- **Kyber512**: Mức bảo mật Level 1
- **Kyber768**: Mức bảo mật Level 3 (khuyến nghị)
- **Kyber1024**: Mức bảo mật Level 5

**Ứng dụng**: Mã hóa dữ liệu nhạy cảm, trao đổi khóa

### 3. **SPHINCS+** - Chữ ký số dựa trên hash (chưa implement)
- Được NIST chọn làm thuật toán dự phòng

## 📁 Cấu trúc thư mục

```
PQC/
├── pom.xml                          # Maven configuration
├── README.md                        # File này
├── INTEGRATION_GUIDE.md             # Hướng dẫn tích hợp
├── src/
│   ├── main/
│   │   └── java/
│   │       └── com/
│   │           └── nt219/
│   │               └── pqc/
│   │                   ├── crypto/
│   │                   │   ├── PQCAlgorithm.java          # Enum các thuật toán
│   │                   │   ├── PQCKeyPair.java            # Cặp khóa
│   │                   │   ├── PQCSignature.java           # Chữ ký số
│   │                   │   ├── IPQCCryptoService.java     # Interface chính
│   │                   │   ├── PQCCryptoFactory.java      # Factory pattern
│   │                   │   └── impl/
│   │                   │       ├── DilithiumService.java   # Implementation Dilithium
│   │                   │       └── KyberService.java       # Implementation Kyber
│   │                   ├── process/
│   │                   │   ├── PQCProcessService.java      # Service tích hợp vào process
│   │                   │   └── SignedTransaction.java     # Transaction có chữ ký
│   │                   └── example/
│   │                       └── PQCExample.java             # Ví dụ sử dụng
│   └── test/
│       └── java/
│           └── com/
│               └── nt219/
│                   └── pqc/
│                       └── crypto/
│                           └── PQCCryptoTest.java          # Unit tests
```

## 🚀 Cách sử dụng

### 1. Build project

```bash
cd PQC
mvn clean compile
mvn package
```

### 2. Chạy ví dụ

```bash
mvn exec:java -Dexec.mainClass="com.nt219.pqc.example.PQCExample"
```

### 3. Chạy tests

```bash
mvn test
```

## 💻 Code Examples

### Ví dụ 1: Ký và xác thực message

```java
import com.nt219.pqc.crypto.*;

// Tạo service
IPQCCryptoService service = PQCCryptoFactory.createService(PQCAlgorithm.DILITHIUM3);

// Tạo cặp khóa
PQCKeyPair keyPair = service.generateKeyPair(PQCAlgorithm.DILITHIUM3);

// Ký message
String message = "Transaction data";
byte[] messageBytes = message.getBytes("UTF-8");
PQCSignature signature = service.sign(messageBytes, keyPair.getPrivateKey(), PQCAlgorithm.DILITHIUM3);

// Xác thực chữ ký
boolean isValid = service.verify(messageBytes, signature, keyPair.getPublicKey(), PQCAlgorithm.DILITHIUM3);
```

### Ví dụ 2: Mã hóa và giải mã

```java
// Tạo service Kyber
IPQCCryptoService service = PQCCryptoFactory.createService(PQCAlgorithm.KYBER768);

// Tạo cặp khóa
PQCKeyPair keyPair = service.generateKeyPair(PQCAlgorithm.KYBER768);

// Mã hóa
String plaintext = "Sensitive data";
byte[] plaintextBytes = plaintext.getBytes("UTF-8");
byte[] ciphertext = service.encrypt(plaintextBytes, keyPair.getPublicKey(), PQCAlgorithm.KYBER768);

// Giải mã
byte[] decrypted = service.decrypt(ciphertext, keyPair.getPrivateKey(), PQCAlgorithm.KYBER768);
String decryptedText = new String(decrypted, "UTF-8");
```

### Ví dụ 3: Sử dụng PQCProcessService (tích hợp vào process)

```java
import com.nt219.pqc.process.*;

// Tạo service
PQCProcessService processService = new PQCProcessService();

// Tạo khóa cho entity
processService.generateKeyPairForEntity("vietcombank");

// Tạo transaction có chữ ký
SignedTransaction transaction = processService.createSignedTransaction(
    "vietcombank",
    "vietinbank",
    1000000.0,
    "Chuyển tiền liên ngân hàng"
);

// Xác thực transaction
boolean isValid = processService.verifySignedTransaction(transaction);
```

## 🔗 Tích hợp vào Process

Xem file [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) để biết chi tiết cách merge code PQC vào process của bạn.

## ⚠️ Lưu ý quan trọng

1. **Implementation hiện tại là mô phỏng**: Code hiện tại là implementation mô phỏng để minh họa cấu trúc và cách sử dụng. Trong production, bạn nên sử dụng:
   - BouncyCastle PQC extensions
   - Các thư viện PQC chuyên dụng từ NIST
   - Open Quantum Safe (OQS) library

2. **Bảo mật khóa**: 
   - Private keys phải được lưu trữ an toàn
   - Sử dụng KeyStore hoặc Hardware Security Module (HSM)
   - Không hardcode keys trong code

3. **Performance**:
   - PQC algorithms thường chậm hơn các thuật toán cổ điển
   - Cân nhắc sử dụng hybrid approach (PQC + classical crypto)

## 📚 Tài liệu tham khảo

- [NIST Post-Quantum Cryptography](https://csrc.nist.gov/projects/post-quantum-cryptography)
- [BouncyCastle](https://www.bouncycastle.org/)
- [Open Quantum Safe](https://openquantumsafe.org/)

## 👥 Đóng góp

Khi merge code vào process, hãy:
1. Đọc kỹ [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)
2. Test kỹ các integration points
3. Đảm bảo backward compatibility nếu có
4. Update documentation

