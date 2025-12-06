# 🚀 Hướng dẫn nhanh - PQC Module

## 📝 Tổng quan

Module PQC (Post-Quantum Cryptography) cung cấp các thuật toán mật mã hậu lượng tử bằng Java để tích hợp vào hệ thống blockchain.

## ⚡ Bắt đầu nhanh

### 1. Build project

```bash
cd ksm 
mvn clean compile
mvn package
```

### 2. Chạy ví dụ

```bash
mvn exec:java -Dexec.mainClass="com.nt219.pqc.example.PQCExample"
```

## 💡 Các trường hợp sử dụng phổ biến

### Trường hợp 1: Ký transaction

```java
// 1. Tạo service
PQCProcessService pqcService = new PQCProcessService();

// 2. Tạo khóa cho ngân hàng
pqcService.generateKeyPairForEntity("vietcombank");

// 3. Ký transaction
PQCSignature signature = pqcService.signTransaction(
    "vietcombank",
    "Transaction data here"
);

// 4. Xác thực chữ ký
boolean isValid = pqcService.verifyTransaction(
    "vietcombank",
    "Transaction data here",
    signature
);
```

### Trường hợp 2: Mã hóa dữ liệu nhạy cảm

```java
// 1. Tạo service
PQCProcessService pqcService = new PQCProcessService();

// 2. Tạo khóa
pqcService.generateKeyPairForEntity("user123");

// 3. Mã hóa
byte[] encrypted = pqcService.encryptSensitiveData(
    "user123",
    "Số tài khoản: 1234567890"
);

// 4. Giải mã
String decrypted = pqcService.decryptSensitiveData("user123", encrypted);
```

### Trường hợp 3: Tạo transaction có chữ ký

```java
// Tạo transaction đã được ký
SignedTransaction tx = pqcService.createSignedTransaction(
    "vietcombank",      // Từ ngân hàng nào
    "vietinbank",       // Đến ngân hàng nào
    1000000.0,          // Số tiền
    "Chuyển tiền"       // Mô tả
);
// Xác thực transaction
boolean isValid = pqcService.verifySignedTransaction(tx);
```
## 🔗 Tích hợp vào code hiện tại

### Bước 1: Thêm dependency

Nếu project của bạn dùng Maven, thêm vào `pom.xml`:

```xml
<dependency>
    <groupId>com.nt219</groupId>
    <artifactId>pqc-crypto</artifactId>
    <version>1.0.0</version>
    <scope>system</scope>
    <systemPath>${project.basedir}/../ksm/target/pqc-crypto-1.0.0.jar</systemPath>
</dependency>
```

### Bước 2: Import vào code

```java
import com.nt219.pqc.crypto.*;
import com.nt219.pqc.process.*;
```

### Bước 3: Sử dụng trong service

```java
@Service
public class YourService {
    private PQCProcessService pqcService = new PQCProcessService();
    
    public void yourMethod() {
        // Sử dụng pqcService ở đây
    }
}
```

## 📚 Tài liệu chi tiết

- **README.md**: Tổng quan về module
- **INTEGRATION_GUIDE.md**: Hướng dẫn tích hợp chi tiết
- **PQCExample.java**: Các ví dụ code mẫu


