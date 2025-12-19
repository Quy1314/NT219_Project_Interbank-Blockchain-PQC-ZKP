/**
 * ZKP Client - Bridge Layer for Zero-Knowledge Proofs
 * 
 * This client communicates with ZKP Prover service
 * to generate and verify balance proofs
 */

export interface BalanceProofRequest {
  user_address: string;
  amount: number;
  balance_commitment: string;
  secret_nonce: string;
}

export interface BalanceProofPublicInputs {
  amount: number;
  commitment_hash: string;
  user_address: string;
}

export interface BalanceProof {
  proof_bytes: number[];
  public_inputs: BalanceProofPublicInputs;
  commitment_hash: string;
}

export interface BalanceProofResponse {
  success: boolean;
  proof: BalanceProof | null;
  message: string;
}

export interface VerifyProofRequest {
  proof: BalanceProof;
  balance_commitment: string;
  secret_nonce: string;
}

export interface VerifyProofResponse {
  success: boolean;
  verified: boolean;
  message: string;
}

export interface ZKPResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export class ZKPClient {
  private baseURL: string;
  private timeout: number;

  constructor(
    baseURL: string = process.env.NEXT_PUBLIC_ZKP_PROVER_URL || 'http://localhost:8081',
    timeout: number = 30000 // 30 seconds for proof generation
  ) {
    this.baseURL = baseURL;
    this.timeout = timeout;
  }

  /**
   * Check ZKP Prover service health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseURL}/health`);
      if (!response.ok) {
        return false;
      }
      const data = await response.json();
      return data.status === 'healthy';
    } catch (error) {
      console.error('[ZKPClient] Health check failed:', error);
      return false;
    }
  }

  /**
   * Generate balance proof
   * Chứng minh rằng balance > amount mà không tiết lộ giá trị balance
   */
  async generateBalanceProof(
    userAddress: string,
    amount: number,
    balance: number,
    secretNonce: string
  ): Promise<BalanceProof> {
    // Tạo balance commitment: encode balance + secret
    // Format: hex(balance) + secret
    const balanceHex = balance.toString(16).padStart(16, '0');
    const balanceCommitment = `${balanceHex}${secretNonce}`;

    const request: BalanceProofRequest = {
      user_address: userAddress,
      amount: amount,
      balance_commitment: balanceCommitment,
      secret_nonce: secretNonce,
    };

    const response = await this.fetchWithTimeout(`${this.baseURL}/balance/proof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const result: BalanceProofResponse = await response.json();
    
    if (!result.success || !result.proof) {
      throw new Error(result.message || 'Failed to generate proof');
    }

    return result.proof;
  }

  /**
   * Verify balance proof
   */
  async verifyBalanceProof(
    proof: BalanceProof,
    balanceCommitment: string,
    secretNonce: string
  ): Promise<boolean> {
    const request: VerifyProofRequest = {
      proof,
      balance_commitment: balanceCommitment,
      secret_nonce: secretNonce,
    };

    const response = await this.fetchWithTimeout(`${this.baseURL}/balance/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const result: VerifyProofResponse = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Verification failed');
    }

    return result.verified;
  }

  /**
   * Get all generated proofs
   */
  async getProofs(): Promise<any[]> {
    const response = await this.fetchWithTimeout(`${this.baseURL}/balance/proofs`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{ status: string; generated_proofs: number }> {
    const response = await this.fetchWithTimeout(`${this.baseURL}/status`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }
}

// Singleton instance
let zkpClientInstance: ZKPClient | null = null;

/**
 * Get ZKP client singleton
 */
export function getZKPClient(): ZKPClient {
  if (!zkpClientInstance) {
    const baseURL = process.env.NEXT_PUBLIC_ZKP_PROVER_URL || 'http://localhost:8081';
    zkpClientInstance = new ZKPClient(baseURL);
  }
  return zkpClientInstance;
}

/**
 * Initialize ZKP client with custom configuration
 */
export function initZKPClient(baseURL: string, timeout?: number): ZKPClient {
  zkpClientInstance = new ZKPClient(baseURL, timeout);
  return zkpClientInstance;
}

