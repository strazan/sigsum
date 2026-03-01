use crate::common::RAYON_THRESHOLD;
use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi]
pub async fn hash_buffer(data: Buffer) -> Result<String> {
    tokio::task::spawn_blocking(move || -> Result<String> {
        let bytes: &[u8] = &data;

        let hash = if bytes.len() >= RAYON_THRESHOLD {
            let mut hasher = blake3::Hasher::new();
            hasher.update_rayon(bytes);
            hasher.finalize()
        } else {
            blake3::hash(bytes)
        };

        Ok(hash.to_hex().to_string())
    })
    .await
    .map_err(|e| Error::new(Status::GenericFailure, format!("Task join error: {e}")))?
}
