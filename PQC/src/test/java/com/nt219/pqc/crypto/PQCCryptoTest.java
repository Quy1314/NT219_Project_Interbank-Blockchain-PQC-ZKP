package com.nt219.pqc.crypto;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests cho PQC Crypto
 */
public class PQCCryptoTest {
    
    @Test
    public void testDilithiumKeyGeneration() throws Exception {
        IPQCCryptoService service = PQCCryptoFactory.createService(PQCAlgorithm.DILITHIUM3);
        PQCKeyPair keyPair = service.generateKeyPair(PQCAlgorithm.DILITHIUM3);
        
        assertNotNull(keyPair);
        assertNotNull(keyPair.getPublicKey());
        assertNotNull(keyPair.getPrivateKey());
        assertEquals("Dilithium3", keyPair.getAlgorithm());
    }
    
    @Test
    public void testDilithiumSignAndVerify() throws Exception {
        IPQCCryptoService service = PQCCryptoFactory.createService(PQCAlgorithm.DILITHIUM3);
        PQCKeyPair keyPair = service.generateKeyPair(PQCAlgorithm.DILITHIUM3);
        
        String message = "Test message";
        byte[] messageBytes = message.getBytes("UTF-8");
        
        PQCSignature signature = service.sign(messageBytes, keyPair.getPrivateKey(), PQCAlgorithm.DILITHIUM3);
        assertNotNull(signature);
        
        boolean isValid = service.verify(messageBytes, signature, keyPair.getPublicKey(), PQCAlgorithm.DILITHIUM3);
        assertTrue(isValid);
    }
    
    @Test
    public void testKyberKeyGeneration() throws Exception {
        IPQCCryptoService service = PQCCryptoFactory.createService(PQCAlgorithm.KYBER768);
        PQCKeyPair keyPair = service.generateKeyPair(PQCAlgorithm.KYBER768);
        
        assertNotNull(keyPair);
        assertNotNull(keyPair.getPublicKey());
        assertNotNull(keyPair.getPrivateKey());
        assertEquals("Kyber768", keyPair.getAlgorithm());
    }
    
    @Test
    public void testKyberEncryptAndDecrypt() throws Exception {
        IPQCCryptoService service = PQCCryptoFactory.createService(PQCAlgorithm.KYBER768);
        PQCKeyPair keyPair = service.generateKeyPair(PQCAlgorithm.KYBER768);
        
        String plaintext = "Secret message";
        byte[] plaintextBytes = plaintext.getBytes("UTF-8");
        
        byte[] ciphertext = service.encrypt(plaintextBytes, keyPair.getPublicKey(), PQCAlgorithm.KYBER768);
        assertNotNull(ciphertext);
        assertNotEquals(plaintextBytes.length, ciphertext.length);
        
        byte[] decrypted = service.decrypt(ciphertext, keyPair.getPrivateKey(), PQCAlgorithm.KYBER768);
        String decryptedText = new String(decrypted, "UTF-8");
        assertEquals(plaintext, decryptedText);
    }
}

