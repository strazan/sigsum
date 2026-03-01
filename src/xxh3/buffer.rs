use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi]
pub async fn hash_buffer_xxh3(data: Buffer) -> Result<String> {
    tokio::task::spawn_blocking(move || -> Result<String> {
        let hash = xxhash_rust::xxh3::xxh3_128(&data);
        Ok(format!("{hash:032x}"))
    })
    .await
    .map_err(|e| Error::new(Status::GenericFailure, format!("Task join error: {e}")))?
}
