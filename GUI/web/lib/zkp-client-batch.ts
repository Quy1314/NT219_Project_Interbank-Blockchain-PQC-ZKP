/**
 * ZKP Client Batch - Batch proof generation API
 * 
 * Uses the new /balance/proofs/batch endpoint for high TPS
 */

import { BalanceProofRequest, BalanceProof } from './zkp-client';

export interface BatchProofRequest {
  requests: BalanceProofRequest[];
}

export interface BatchProofResponse {
  success: boolean;
  proofs: Array<BalanceProof | null>;
  errors: Array<string | null>;
  message: string;
}

/**
 * Generate multiple proofs in a single batch request
 */
export async function generateBatchProofs(
  baseURL: string,
  requests: BalanceProofRequest[],
  timeout: number = 30000
): Promise<BatchProofResponse> {
  if (requests.length > 100) {
    throw new Error('Batch size too large (max 100)');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${baseURL}/balance/proofs/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const result: BatchProofResponse = await response.json();
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

