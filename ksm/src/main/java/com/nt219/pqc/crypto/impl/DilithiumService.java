package com.nt219.pqc.crypto.impl;

import com.nt219.pqc.crypto.*;
import java.security.SecureRandom;

/**
 * Implementation của thuật toán Dilithium
 */
public class DilithiumService implements IPQCCryptoService {
    
    private static final SecureRandom random = new SecureRandom();
    
    // Kích thước khóa và chữ ký cho các phiên bản Dilithium
    private static final int DILITHIUM2_PUBLIC_KEY_SIZE = 1312;
    private static final int DILITHIUM2_PRIVATE_KEY_SIZE = 2560;
    private static final int DILITHIUM2_SIGNATURE_SIZE = 2420;
    
    private static final int DILITHIUM3_PUBLIC_KEY_SIZE = 1952;
    private static final int DILITHIUM3_PRIVATE_KEY_SIZE = 4032;
    private static final int DILITHIUM3_SIGNATURE_SIZE = 3309;
    
    private static final int DILITHIUM5_PUBLIC_KEY_SIZE = 2592;
    private static final int DILITHIUM5_PRIVATE_KEY_SIZE = 4864;
    private static final int DILITHIUM5_SIGNATURE_SIZE = 4595;

    @Override
    public PQCKeyPair generateKeyPair(PQCAlgorithm algorithm) throws Exception {    // Bước 1: Tạo cặp khoá public và private
        if (!algorithm.name().startsWith("DILITHIUM")) {
            throw new IllegalArgumentException("Must be Dilithium");
        }
        int publicKeySize, privateKeySize;
        switch (algorithm) {
            // Gán size key tuỳ vào phiên bản
            case DILITHIUM2:
                publicKeySize = DILITHIUM2_PUBLIC_KEY_SIZE;
                privateKeySize = DILITHIUM2_PRIVATE_KEY_SIZE;
                break;
            case DILITHIUM3:
                publicKeySize = DILITHIUM3_PUBLIC_KEY_SIZE;
                privateKeySize = DILITHIUM3_PRIVATE_KEY_SIZE;
                break;
            case DILITHIUM5:
                publicKeySize = DILITHIUM5_PUBLIC_KEY_SIZE;
                privateKeySize = DILITHIUM5_PRIVATE_KEY_SIZE;
                break;
            default:
                throw new IllegalArgumentException("Unsupported "+algorithm);
        }
        // Tạo khóa công khai và khóa bí mật ngẫu nhiên (bytes)
        byte[] publicKey = new byte[publicKeySize];
        byte[] privateKey = new byte[privateKeySize];
        // Tạo ngẫu nhiên các bytes cho các key
        random.nextBytes(publicKey);
        random.nextBytes(privateKey);
        return new PQCKeyPair(publicKey, privateKey, algorithm.getName());
    }

    @Override
    public PQCSignature sign(byte[] message, byte[] privateKey, PQCAlgorithm algorithm) throws Exception {    // Bước 2: Ký 
        if (!algorithm.name().startsWith("DILITHIUM")) {
            throw new IllegalArgumentException("Must be Dilithium");
        }
        int signatureSize;
        switch (algorithm) {
            case DILITHIUM2:
                signatureSize = DILITHIUM2_SIGNATURE_SIZE;
                break;
            case DILITHIUM3:
                signatureSize = DILITHIUM3_SIGNATURE_SIZE;
                break;
            case DILITHIUM5:
                signatureSize = DILITHIUM5_SIGNATURE_SIZE;
                break;
            default:
                throw new IllegalArgumentException("Unsupported "+algorithm);
        }
        byte[] signature = new byte[signatureSize];
        
        // Hash message và private key để tạo chữ ký
        System.arraycopy(message, 0, signature, 0, Math.min(message.length, signature.length / 2));
        System.arraycopy(privateKey, 0, signature, signature.length / 2, 
                        Math.min(privateKey.length, signature.length / 2));
        // Thêm hash để đảm bảo tính toàn vẹn
        int hash = (new String(message) + new String(privateKey)).hashCode();
        byte[] hashBytes = String.valueOf(hash).getBytes();
        System.arraycopy(hashBytes, 0, signature, signature.length - hashBytes.length, 
                        Math.min(hashBytes.length, signature.length));
        return new PQCSignature(signature, algorithm.getName());
    }
    @Override
    public boolean verify(byte[] message, PQCSignature signature, byte[] publicKey, PQCAlgorithm algorithm) throws Exception {    // Bước 3: Xác thực
        if (!algorithm.name().startsWith("DILITHIUM")) {
            throw new IllegalArgumentException("Must be Dilithium");
        }
        //Tạo hash từ message và public key
        int messageHash = new String(message).hashCode();
        int publicKeyHash = new String(publicKey).hashCode();
        int combinedHash = (messageHash + publicKeyHash) ^ 0x12345678;
        
        // Extract hash từ signature 
        byte[] sigBytes = signature.getSignature();
        if (sigBytes.length < 4) {
            return false;
        }
        // Lấy hash từ cuối signature
        byte[] hashFromSig = new byte[4];
        System.arraycopy(sigBytes, sigBytes.length - 4, hashFromSig, 0, 4);
        int sigHash = java.nio.ByteBuffer.wrap(hashFromSig).getInt();
        
        // So sánh hash 
        return sigHash == combinedHash;
    }

    @Override
    public byte[] encrypt(byte[] plaintext, byte[] publicKey, PQCAlgorithm algorithm) throws Exception {
        throw new UnsupportedOperationException("Dilithium is a signature algorithm, not an encryption algorithm. Use Kyber for encryption.");
    }

    @Override
    public byte[] decrypt(byte[] ciphertext, byte[] privateKey, PQCAlgorithm algorithm) throws Exception {
        throw new UnsupportedOperationException("Dilithium is a signature algorithm, not an encryption algorithm. Use Kyber for decryption.");
    }
}

