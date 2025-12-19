use serde::{Deserialize, Serialize};
use sha3::{Digest, Sha3_256};
use std::fmt;

/// Balance proof request
/// Chứng minh rằng balance > amount mà không tiết lộ giá trị balance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceProofRequest {
    /// Address của user (để verify balance từ blockchain)
    pub user_address: String,
    /// Số tiền cần chuyển (public)
    pub amount: u64,
    /// Balance commitment (hash của balance + secret)
    pub balance_commitment: String,
    /// Secret nonce để tạo commitment
    pub secret_nonce: String,
}

/// Balance proof response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceProof {
    /// Proof bytes (serialized proof)
    pub proof_bytes: Vec<u8>,
    /// Public inputs: amount, balance_commitment_hash
    pub public_inputs: BalanceProofPublicInputs,
    /// Balance commitment hash (public)
    pub commitment_hash: String,
}

/// Public inputs cho balance proof
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceProofPublicInputs {
    /// Số tiền cần chuyển (public)
    pub amount: u64,
    /// Hash của balance commitment
    pub commitment_hash: String,
    /// User address
    pub user_address: String,
}

impl BalanceProof {
    /// Tạo balance proof đơn giản
    /// Chứng minh: balance > amount
    /// 
    /// Approach: Sử dụng range proof đơn giản
    /// - Tạo commitment: hash(balance || secret_nonce)
    /// - Chứng minh: balance - amount > 0 mà không tiết lộ balance
    pub fn generate(request: &BalanceProofRequest) -> Result<Self, String> {
        // Parse balance từ commitment (trong thực tế, đây sẽ là từ blockchain)
        // Tạm thời giả sử balance được encode trong commitment
        let balance = Self::extract_balance_from_commitment(&request.balance_commitment)?;
        
        // Verify: balance > amount
        if balance <= request.amount {
            return Err(format!(
                "Invalid proof: balance {} <= amount {}",
                balance, request.amount
            ));
        }
        
        // Tạo proof đơn giản
        // Trong implementation thực tế, đây sẽ là STARK proof
        // Tạm thời sử dụng hash-based proof đơn giản
        let diff = balance - request.amount;
        
        // Tạo proof data: hash(amount || diff || commitment || secret)
        let mut hasher = Sha3_256::new();
        hasher.update(request.amount.to_be_bytes());
        hasher.update(diff.to_be_bytes());
        hasher.update(request.balance_commitment.as_bytes());
        hasher.update(request.secret_nonce.as_bytes());
        let proof_hash = hasher.finalize();
        
        // Public inputs
        let mut commitment_hasher = Sha3_256::new();
        commitment_hasher.update(request.balance_commitment.as_bytes());
        let commitment_hash = hex::encode(commitment_hasher.finalize());
        
        let public_inputs = BalanceProofPublicInputs {
            amount: request.amount,
            commitment_hash: commitment_hash.clone(),
            user_address: request.user_address.clone(),
        };
        
        Ok(BalanceProof {
            proof_bytes: proof_hash.to_vec(),
            public_inputs,
            commitment_hash,
        })
    }
    
    /// Extract balance từ commitment
    /// Format: hex(balance) + secret_nonce
    /// Ví dụ: "00000000000003e8secret123" = balance 1000 + secret "secret123"
    fn extract_balance_from_commitment(commitment: &str) -> Result<u64, String> {
        // Try to parse hex balance from beginning of commitment
        // Balance is encoded as 16 hex chars (8 bytes) = 64-bit number
        if commitment.len() >= 16 {
            // Try to extract first 16 chars as hex balance
            let balance_str = &commitment[..16];
            if let Ok(balance) = u64::from_str_radix(balance_str, 16) {
                return Ok(balance);
            }
        }
        
        // Fallback: try hex decode entire commitment
        if let Ok(bytes) = hex::decode(commitment) {
            if bytes.len() >= 8 {
                let balance = u64::from_be_bytes([
                    bytes[0], bytes[1], bytes[2], bytes[3],
                    bytes[4], bytes[5], bytes[6], bytes[7],
                ]);
                return Ok(balance);
            }
        }
        
        Err("Cannot extract balance from commitment".to_string())
    }
    
    /// Verify balance proof
    pub fn verify(&self, balance_commitment: &str, secret_nonce: &str) -> Result<bool, String> {
        // Recreate proof hash
        let mut hasher = Sha3_256::new();
        hasher.update(self.public_inputs.amount.to_be_bytes());
        
        // Calculate diff từ commitment (mock)
        let balance = Self::extract_balance_from_commitment(balance_commitment)?;
        if balance <= self.public_inputs.amount {
            return Ok(false);
        }
        
        let diff = balance - self.public_inputs.amount;
        hasher.update(diff.to_be_bytes());
        hasher.update(balance_commitment.as_bytes());
        hasher.update(secret_nonce.as_bytes());
        let expected_proof = hasher.finalize();
        
        // Verify proof hash matches
        if self.proof_bytes != expected_proof.to_vec() {
            return Ok(false);
        }
        
        // Verify commitment hash
        let mut commitment_hasher = Sha3_256::new();
        commitment_hasher.update(balance_commitment.as_bytes());
        let expected_commitment_hash = hex::encode(commitment_hasher.finalize());
        
        if self.commitment_hash != expected_commitment_hash {
            return Ok(false);
        }
        
        Ok(true)
    }
    
    /// Convert proof to hex string
    pub fn to_hex(&self) -> String {
        hex::encode(&self.proof_bytes)
    }
    
    /// Get proof size in bytes
    pub fn size(&self) -> usize {
        self.proof_bytes.len()
    }
}

impl fmt::Display for BalanceProof {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "BalanceProof(amount={}, commitment_hash={}, proof_size={} bytes)",
            self.public_inputs.amount,
            &self.commitment_hash[..16],
            self.size()
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_balance_proof_generation() {
        let balance = 1000u64;
        let amount = 500u64;
        let secret = "secret_nonce_123";
        
        // Create commitment: encode balance + secret
        let commitment = format!("{:016x}{}", balance, secret);
        
        let request = BalanceProofRequest {
            user_address: "0x1234".to_string(),
            amount,
            balance_commitment: commitment.clone(),
            secret_nonce: secret.to_string(),
        };
        
        let proof = BalanceProof::generate(&request);
        assert!(proof.is_ok());
        
        let proof = proof.unwrap();
        assert_eq!(proof.public_inputs.amount, amount);
        
        // Verify proof
        let verified = proof.verify(&commitment, secret);
        assert!(verified.is_ok());
        assert!(verified.unwrap());
    }
    
    #[test]
    fn test_balance_proof_reject_insufficient_balance() {
        let balance = 100u64;
        let amount = 500u64; // amount > balance
        let secret = "secret_nonce_123";
        
        let commitment = format!("{:016x}{}", balance, secret);
        
        let request = BalanceProofRequest {
            user_address: "0x1234".to_string(),
            amount,
            balance_commitment: commitment,
            secret_nonce: secret.to_string(),
        };
        
        let proof = BalanceProof::generate(&request);
        assert!(proof.is_err());
    }
}

