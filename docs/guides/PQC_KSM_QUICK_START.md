# 🚀 Quick Start: Tích hợp PQC & KSM

> **Mục tiêu:** Chạy được PQC signing trong 30 phút

## ✅ Kết luận nhanh

**CÓ THỂ TÍCH HỢP** - PQC và KSM đã sẵn sàng nhưng cần hoàn thiện KSM service.

Chi tiết: Xem [PQC_KSM_INTEGRATION_ANALYSIS.md](../architecture/PQC_KSM_INTEGRATION_ANALYSIS.md)

---

## 🏃 Bắt đầu ngay (30 phút)

### Bước 1: Test PQC Module (5 phút)

```bash
# 1. Kiểm tra PQC module
cd PQC

# 2. Build
mvn clean compile

# 3. Chạy tests
mvn test

# 4. Chạy example
mvn exec:java -Dexec.mainClass="com.nt219.pqc.example.PQCExample"
```

**Kết quả mong đợi:**
```
=== PQC Crypto Example ===

1. Testing Dilithium (Signature)
Generated Dilithium3 key pair
Signed message successfully
✓ Signature verified: true

2. Testing Kyber (Encryption)
Generated Kyber768 key pair
Encrypted data successfully
✓ Decryption successful: Hello PQC!

3. Testing Transaction Signing
Created signed transaction
✓ Transaction verified: true
```

### Bước 2: Setup KSM Structure (10 phút)

```bash
cd /home/quy/project/NT219_Project

# 1. Tạo cấu trúc KSM đầy đủ
mkdir -p ksm/src/{main,test}/java/com/nt219/ksm

# 2. Copy PQC code vào KSM
cp -r PQC/src/main/java/com/nt219/pqc/* \
     ksm/src/main/java/com/nt219/ksm/

# 3. Copy pom.xml
cp PQC/pom.xml ksm/

# 4. Update artifact ID trong ksm/pom.xml
sed -i 's/<artifactId>pqc/<artifactId>ksm/' ksm/pom.xml

# 5. Rename packages
find ksm/src -name "*.java" -exec sed -i 's/package com.nt219.pqc/package com.nt219.ksm/g' {} +
find ksm/src -name "*.java" -exec sed -i 's/import com.nt219.pqc/import com.nt219.ksm/g' {} +
```

### Bước 3: Build KSM (5 phút)

```bash
cd ksm

# Build
mvn clean compile package

# Test
mvn test

# Chạy example
mvn exec:java -Dexec.mainClass="com.nt219.ksm.example.PQCExample"
```

### Bước 4: Thêm Spring Boot cho KSM (10 phút)

Cập nhật `ksm/pom.xml`:

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.0</version>
</parent>

<dependencies>
    <!-- Spring Boot Web -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    
    <!-- Existing dependencies -->
    <!-- ... -->
</dependencies>
```

Tạo `ksm/src/main/java/com/nt219/ksm/KSMApplication.java`:

```java
package com.nt219.ksm;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class KSMApplication {
    public static void main(String[] args) {
        SpringApplication.run(KSMApplication.class, args);
    }
}
```

Tạo `ksm/src/main/java/com/nt219/ksm/controller/KSMController.java`:

```java
package com.nt219.ksm.controller;

import com.nt219.ksm.crypto.*;
import com.nt219.ksm.process.PQCProcessService;
import org.springframework.web.bind.annotation.*;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/ksm")
public class KSMController {
    
    private final PQCProcessService pqcService;
    
    public KSMController() {
        this.pqcService = new PQCProcessService();
    }
    
    @PostMapping("/generateKey")
    public Map<String, Object> generateKey(@RequestBody Map<String, String> request) {
        try {
            String entityId = request.get("entityId");
            PQCKeyPair keyPair = pqcService.generateKeyPairForEntity(entityId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("entityId", entityId);
            response.put("publicKey", Base64.getEncoder().encodeToString(keyPair.getPublicKey()));
            response.put("algorithm", keyPair.getAlgorithm());
            return response;
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return error;
        }
    }
    
    @PostMapping("/sign")
    public Map<String, Object> sign(@RequestBody Map<String, String> request) {
        try {
            String entityId = request.get("entityId");
            String message = request.get("message");
            
            PQCSignature signature = pqcService.signTransaction(entityId, message);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("signature", Base64.getEncoder().encodeToString(signature.getSignature()));
            response.put("algorithm", signature.getAlgorithm());
            return response;
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return error;
        }
    }
    
    @PostMapping("/verify")
    public Map<String, Object> verify(@RequestBody Map<String, String> request) {
        try {
            String entityId = request.get("entityId");
            String message = request.get("message");
            byte[] signatureBytes = Base64.getDecoder().decode(request.get("signature"));
            String algorithm = request.get("algorithm");
            
            PQCSignature signature = new PQCSignature(signatureBytes, algorithm);
            boolean isValid = pqcService.verifyTransaction(entityId, message, signature);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("valid", isValid);
            return response;
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return error;
        }
    }
    
    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "KSM");
        response.put("algorithms", new String[]{"DILITHIUM2", "DILITHIUM3", "DILITHIUM5"});
        return response;
    }
}
```

Tạo `ksm/src/main/resources/application.properties`:

```properties
server.port=8080
spring.application.name=ksm-service
logging.level.com.nt219.ksm=DEBUG
```

### Bước 5: Chạy KSM Service

```bash
cd ksm

# Build with Spring Boot
mvn clean package spring-boot:repackage

# Run
java -jar target/ksm-*.jar

# Hoặc dùng Maven
mvn spring-boot:run
```

**Kết quả:**
```
  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
( ( )\___ | '_ | '_| | '_ \/ _` | \ \ \ \
 \\/  ___)| |_)| | | | | || (_| |  ) ) ) )
  '  |____| .__|_| |_|_| |_\__, | / / / /
 =========|_|==============|___/=/_/_/_/
 :: Spring Boot ::                (v3.2.0)

KSM Service started on port 8080
```

### Bước 6: Test KSM API

```bash
# Test health
curl http://localhost:8080/ksm/health

# Generate key
curl -X POST http://localhost:8080/ksm/generateKey \
  -H "Content-Type: application/json" \
  -d '{"entityId":"vietcombank"}'

# Sign message
curl -X POST http://localhost:8080/ksm/sign \
  -H "Content-Type: application/json" \
  -d '{
    "entityId":"vietcombank",
    "message":"Transfer 1000000 VND to vietinbank"
  }'

# Verify signature
curl -X POST http://localhost:8080/ksm/verify \
  -H "Content-Type: application/json" \
  -d '{
    "entityId":"vietcombank",
    "message":"Transfer 1000000 VND to vietinbank",
    "signature":"<BASE64_SIGNATURE>",
    "algorithm":"Dilithium3"
  }'
```

---

## 🎯 Kiểm tra hoàn thành

- [ ] PQC tests pass
- [ ] KSM builds successfully
- [ ] KSM service starts on port 8080
- [ ] Can call `/ksm/health` endpoint
- [ ] Can generate PQC key via API
- [ ] Can sign message via API
- [ ] Can verify signature via API

---

## 📦 Docker-ize (Bonus)

Tạo `ksm/Dockerfile`:

```dockerfile
FROM openjdk:17-slim
WORKDIR /app
COPY target/ksm-*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

Build và run:

```bash
cd ksm
docker build -t ksm-service .
docker run -p 8080:8080 ksm-service
```

---

## 🔗 Next Steps

Sau khi hoàn thành Quick Start:

1. **Integration với GUI:** Xem `PQC_KSM_INTEGRATION_ANALYSIS.md` Section "Bridge Layer"
2. **Add persistence:** Implement key storage với SQLite
3. **Add to docker-compose:** Tích hợp KSM vào mạng blockchain
4. **Security hardening:** Encrypt private keys, add authentication

---

## 📚 Tài liệu liên quan

- [PQC_KSM_INTEGRATION_ANALYSIS.md](../architecture/PQC_KSM_INTEGRATION_ANALYSIS.md) - Phân tích chi tiết
- [NT219_BaoCaoTienDo-2.pdf](../reference/NT219_BaoCaoTienDo-2.pdf) - Section 5.1 (Track A)
- [PQC README](../../PQC/README.md) - PQC module documentation

---

**Status:** ✅ Ready to use  
**Time required:** 30-60 phút  
**Difficulty:** Medium

