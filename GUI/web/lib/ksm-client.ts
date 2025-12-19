/**
 * KSM Client - Bridge Layer for Post-Quantum Cryptography
 * 
 * This client communicates with KSM (Key Simulation Module) service
 * to perform PQC operations: key generation, signing, verification
 */

export interface PQCKeyPair {
  publicKey: string; // Base64 encoded
  algorithm: string;
  publicKeySize: number;
}

export interface PQCSignature {
  signature: string; // Base64 encoded
  algorithm: string;
  signatureSize: number;
  timestamp: number;
}

export interface SignedTransaction {
  transaction: {
    from: string;
    to: string;
    amount: number;
    description: string;
    timestamp: number;
  };
  signature: string; // Base64 encoded
  algorithm: string;
}

export interface KSMResponse<T> {
  success: boolean;
  error?: string;
  timestamp?: number;
  data?: T;
}

export class KSMClient {
  private baseURL: string;
  private timeout: number;

  constructor(
    baseURL: string = process.env.NEXT_PUBLIC_KSM_URL || 'http://localhost:8080/ksm',
    timeout: number = 10000
  ) {
    this.baseURL = baseURL.endsWith('/ksm') ? baseURL : `${baseURL}/ksm`;
    this.timeout = timeout;
  }

  /**
   * Check KSM service health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseURL}/health`);
      const data = await response.json();
      return data.status === 'UP';
    } catch (error) {
      console.error('[KSM Client] Health check failed:', error);
      return false;
    }
  }

  /**
   * Generate PQC key pair for an entity
   */
  async generateKey(entityId: string): Promise<PQCKeyPair> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseURL}/generateKey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Key generation failed');
      }

      return {
        publicKey: data.publicKey,
        algorithm: data.algorithm,
        publicKeySize: data.publicKeySize
      };
    } catch (error) {
      console.error('[KSM Client] Key generation failed:', error);
      throw new Error(`Failed to generate key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sign a transaction or message
   */
  async sign(entityId: string, message: string): Promise<PQCSignature> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseURL}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, message })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Signing failed');
      }

      return {
        signature: data.signature,
        algorithm: data.algorithm,
        signatureSize: data.signatureSize,
        timestamp: data.timestamp
      };
    } catch (error) {
      console.error('[KSM Client] Signing failed:', error);
      throw new Error(`Failed to sign: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify a signature
   */
  async verify(
    entityId: string,
    message: string,
    signature: string,
    algorithm: string = 'Dilithium3'
  ): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseURL}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, message, signature, algorithm })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Verification failed');
      }

      return data.valid;
    } catch (error) {
      console.error('[KSM Client] Verification failed:', error);
      throw new Error(`Failed to verify: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a signed transaction
   */
  async createSignedTransaction(
    from: string,
    to: string,
    amount: number,
    description: string
  ): Promise<SignedTransaction> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseURL}/createSignedTransaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, amount, description })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Transaction creation failed');
      }

      return {
        transaction: data.transaction,
        signature: data.signature,
        algorithm: data.algorithm
      };
    } catch (error) {
      console.error('[KSM Client] Transaction creation failed:', error);
      throw new Error(`Failed to create transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get public key for an entity
   */
  async getPublicKey(entityId: string): Promise<PQCKeyPair> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseURL}/publicKey/${entityId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get public key');
      }

      return {
        publicKey: data.publicKey,
        algorithm: data.algorithm,
        publicKeySize: data.publicKeySize
      };
    } catch (error) {
      console.error('[KSM Client] Get public key failed:', error);
      throw new Error(`Failed to get public key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Helper: Fetch with timeout
   */
  private async fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      
      throw error;
    }
  }
}

// Singleton instance
let ksmClientInstance: KSMClient | null = null;

/**
 * Get KSM client singleton
 */
export function getKSMClient(): KSMClient {
  if (!ksmClientInstance) {
    const baseURL = process.env.NEXT_PUBLIC_KSM_URL || 'http://localhost:8080/ksm';
    ksmClientInstance = new KSMClient(baseURL);
  }
  return ksmClientInstance;
}

/**
 * Initialize KSM client with custom configuration
 */
export function initKSMClient(baseURL: string, timeout?: number): KSMClient {
  ksmClientInstance = new KSMClient(baseURL, timeout);
  return ksmClientInstance;
}

