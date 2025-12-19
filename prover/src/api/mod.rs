use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

use crate::balance_proof::{BalanceProof, BalanceProofRequest};

#[derive(Clone)]
pub struct AppState {
    pub proofs: Arc<Mutex<Vec<BalanceProof>>>,
}

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub version: String,
}

#[derive(Serialize)]
pub struct BalanceProofResponse {
    pub success: bool,
    pub proof: Option<BalanceProof>,
    pub message: String,
}

/// Health check endpoint
async fn health() -> impl Responder {
    HttpResponse::Ok().json(HealthResponse {
        status: "healthy".to_string(),
        service: "zkp-prover-balance".to_string(),
        version: "0.1.0".to_string(),
    })
}

/// Generate balance proof
/// POST /balance/proof
/// Body: BalanceProofRequest
async fn generate_balance_proof(
    data: web::Data<AppState>,
    req: web::Json<BalanceProofRequest>,
) -> impl Responder {
    log::info!("Generating balance proof for user: {}", req.user_address);
    log::info!("Amount: {}", req.amount);
    
    match BalanceProof::generate(&req) {
        Ok(proof) => {
            log::info!("Balance proof generated successfully: {}", proof);
            
            // Store proof
            data.proofs.lock().unwrap().push(proof.clone());
            
            HttpResponse::Ok().json(BalanceProofResponse {
                success: true,
                proof: Some(proof),
                message: "Balance proof generated successfully".to_string(),
            })
        }
        Err(e) => {
            log::error!("Failed to generate balance proof: {}", e);
            HttpResponse::BadRequest().json(BalanceProofResponse {
                success: false,
                proof: None,
                message: format!("Failed to generate proof: {}", e),
            })
        }
    }
}

/// Verify balance proof
/// POST /balance/verify
#[derive(Deserialize)]
pub struct VerifyProofRequest {
    pub proof: BalanceProof,
    pub balance_commitment: String,
    pub secret_nonce: String,
}

#[derive(Serialize)]
pub struct VerifyProofResponse {
    pub success: bool,
    pub verified: bool,
    pub message: String,
}

async fn verify_balance_proof(req: web::Json<VerifyProofRequest>) -> impl Responder {
    log::info!("Verifying balance proof");
    
    match req.proof.verify(&req.balance_commitment, &req.secret_nonce) {
        Ok(verified) => {
            if verified {
                log::info!("Balance proof verified successfully");
                HttpResponse::Ok().json(VerifyProofResponse {
                    success: true,
                    verified: true,
                    message: "Proof verified successfully".to_string(),
                })
            } else {
                log::warn!("Balance proof verification failed");
                HttpResponse::Ok().json(VerifyProofResponse {
                    success: true,
                    verified: false,
                    message: "Proof verification failed".to_string(),
                })
            }
        }
        Err(e) => {
            log::error!("Error verifying proof: {}", e);
            HttpResponse::BadRequest().json(VerifyProofResponse {
                success: false,
                verified: false,
                message: format!("Verification error: {}", e),
            })
        }
    }
}

/// Get all generated proofs
/// GET /balance/proofs
async fn get_proofs(data: web::Data<AppState>) -> impl Responder {
    let proofs = data.proofs.lock().unwrap();
    let proof_info: Vec<_> = proofs.iter().map(|p| {
        serde_json::json!({
            "amount": p.public_inputs.amount,
            "user_address": p.public_inputs.user_address,
            "commitment_hash": p.commitment_hash,
            "proof_hex": p.to_hex(),
            "proof_size": p.size()
        })
    }).collect();
    
    HttpResponse::Ok().json(proof_info)
}

/// Status endpoint
#[derive(Serialize)]
pub struct StatusResponse {
    pub status: String,
    pub generated_proofs: usize,
}

async fn status(data: web::Data<AppState>) -> impl Responder {
    let proofs_count = data.proofs.lock().unwrap().len();
    
    HttpResponse::Ok().json(StatusResponse {
        status: "running".to_string(),
        generated_proofs: proofs_count,
    })
}

pub async fn start_server() -> std::io::Result<()> {
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));
    
    log::info!("Starting ZKP Balance Prover Service...");
    
    // Initialize state
    let proofs = Arc::new(Mutex::new(Vec::new()));
    
    let app_state = web::Data::new(AppState {
        proofs,
    });
    
    log::info!("Prover service listening on http://0.0.0.0:8081");
    
    HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            .route("/health", web::get().to(health))
            .route("/status", web::get().to(status))
            .route("/balance/proof", web::post().to(generate_balance_proof))
            .route("/balance/verify", web::post().to(verify_balance_proof))
            .route("/balance/proofs", web::get().to(get_proofs))
    })
    .bind(("0.0.0.0", 8081))?
    .run()
    .await
}

