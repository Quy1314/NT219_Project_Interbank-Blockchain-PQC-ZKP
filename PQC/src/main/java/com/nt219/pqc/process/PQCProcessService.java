package com.nt219.pqc.process;

import com.nt219.pqc.crypto.*;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Service để tích hợp PQC vào các process của hệ thống
 * 
 * Lớp này cung cấp các phương thức tiện ích để:
 * - Ký và xác thực transactions
 * - Mã hóa và giải mã dữ liệu nhạy cảm
 * - Quản lý khóa PQC
 */
public class PQCProcessService {
    
    private final Map<String, PQCKeyPair> keyStore;
    private final PQCAlgorithm defaultSignatureAlgorithm;
    private final PQCAlgorithm defaultEncryptionAlgorithm;
    
    public PQCProcessService() {
        this.keyStore = new HashMap<>();
        this.defaultSignatureAlgorithm = PQCAlgorithm.DILITHIUM3;
        this.defaultEncryptionAlgorithm = PQCAlgorithm.KYBER768;
    }
    
    public PQCProcessService(PQCAlgorithm signatureAlgorithm, PQCAlgorithm encryptionAlgorithm) {
        this.keyStore = new HashMap<>();
        this.defaultSignatureAlgorithm = signatureAlgorithm;
        this.defaultEncryptionAlgorithm = encryptionAlgorithm;
    }
    
    /**
     * Tạo cặp khóa cho một user/entity
     * @param entityId ID của entity (ví dụ: user ID, bank code)
     * @return Cặp khóa được tạo
     */
    public PQCKeyPair generateKeyPairForEntity(String entityId) throws Exception {
        IPQCCryptoService service = PQCCryptoFactory.createService(defaultSignatureAlgorithm);
        PQCKeyPair keyPair = service.generateKeyPair(defaultSignatureAlgorithm);
        keyStore.put(entityId, keyPair);
        return keyPair;
    }
    
    /**
     * Lấy cặp khóa của một entity
     */
    public PQCKeyPair getKeyPair(String entityId) {
        return keyStore.get(entityId);
    }
    
    /**
     * Ký một transaction hoặc message
     * @param entityId ID của entity thực hiện ký
     * @param message Dữ liệu cần ký
     * @return Chữ ký số
     */
    public PQCSignature signTransaction(String entityId, String message) throws Exception {
        PQCKeyPair keyPair = keyStore.get(entityId);
        if (keyPair == null) {
            throw new IllegalArgumentException("Key pair not found for entity: " + entityId);
        }
        
        IPQCCryptoService service = PQCCryptoFactory.createService(defaultSignatureAlgorithm);
        byte[] messageBytes = message.getBytes(StandardCharsets.UTF_8);
        return service.sign(messageBytes, keyPair.getPrivateKey(), defaultSignatureAlgorithm);
    }
    
    /**
     * Xác thực chữ ký của transaction
     * @param entityId ID của entity đã ký
     * @param message Dữ liệu gốc
     * @param signature Chữ ký số
     * @return true nếu chữ ký hợp lệ
     */
    public boolean verifyTransaction(String entityId, String message, PQCSignature signature) throws Exception {
        PQCKeyPair keyPair = keyStore.get(entityId);
        if (keyPair == null) {
            throw new IllegalArgumentException("Key pair not found for entity: " + entityId);
        }
        
        IPQCCryptoService service = PQCCryptoFactory.createService(defaultSignatureAlgorithm);
        byte[] messageBytes = message.getBytes(StandardCharsets.UTF_8);
        return service.verify(messageBytes, signature, keyPair.getPublicKey(), defaultSignatureAlgorithm);
    }
    
    /**
     * Mã hóa dữ liệu nhạy cảm
     * @param entityId ID của entity nhận (có public key)
     * @param plaintext Dữ liệu cần mã hóa
     * @return Dữ liệu đã mã hóa
     */
    public byte[] encryptSensitiveData(String entityId, String plaintext) throws Exception {
        PQCKeyPair keyPair = keyStore.get(entityId);
        if (keyPair == null) {
            throw new IllegalArgumentException("Key pair not found for entity: " + entityId);
        }
        
        IPQCCryptoService service = PQCCryptoFactory.createService(defaultEncryptionAlgorithm);
        byte[] plaintextBytes = plaintext.getBytes(StandardCharsets.UTF_8);
        return service.encrypt(plaintextBytes, keyPair.getPublicKey(), defaultEncryptionAlgorithm);
    }
    
    /**
     * Giải mã dữ liệu nhạy cảm
     * @param entityId ID của entity sở hữu private key
     * @param ciphertext Dữ liệu đã mã hóa
     * @return Dữ liệu đã giải mã
     */
    public String decryptSensitiveData(String entityId, byte[] ciphertext) throws Exception {
        PQCKeyPair keyPair = keyStore.get(entityId);
        if (keyPair == null) {
            throw new IllegalArgumentException("Key pair not found for entity: " + entityId);
        }
        
        IPQCCryptoService service = PQCCryptoFactory.createService(defaultEncryptionAlgorithm);
        byte[] decrypted = service.decrypt(ciphertext, keyPair.getPrivateKey(), defaultEncryptionAlgorithm);
        return new String(decrypted, StandardCharsets.UTF_8);
    }
    
    /**
     * Tạo transaction object với chữ ký PQC
     * @param fromEntityId ID của entity gửi
     * @param toEntityId ID của entity nhận
     * @param amount Số tiền
     * @param description Mô tả
     * @return Transaction object với chữ ký
     */
    public SignedTransaction createSignedTransaction(
            String fromEntityId, 
            String toEntityId, 
            double amount, 
            String description) throws Exception {
        
        // Tạo transaction data
        String transactionData = String.format(
            "FROM:%s|TO:%s|AMOUNT:%.2f|DESC:%s|TIMESTAMP:%d",
            fromEntityId, toEntityId, amount, description, System.currentTimeMillis()
        );
        
        // Ký transaction
        PQCSignature signature = signTransaction(fromEntityId, transactionData);
        
        return new SignedTransaction(
            fromEntityId,
            toEntityId,
            amount,
            description,
            transactionData,
            signature,
            System.currentTimeMillis()
        );
    }
    
    /**
     * Xác thực signed transaction
     */
    public boolean verifySignedTransaction(SignedTransaction transaction) throws Exception {
        return verifyTransaction(
            transaction.getFromEntityId(),
            transaction.getTransactionData(),
            transaction.getSignature()
        );
    }
}

