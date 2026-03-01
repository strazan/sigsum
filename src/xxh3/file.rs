use crate::common::{read_file, FileHashResult};
use napi::bindgen_prelude::*;
use napi_derive::napi;
use rayon::prelude::*;

#[inline]
fn hash_file_sync(path: &str) -> Result<FileHashResult> {
    let file_data = read_file(path, None)?;
    let hash = xxhash_rust::xxh3::xxh3_128(file_data.as_bytes());

    Ok(FileHashResult {
        hash: format!("{hash:032x}"),
        size: file_data.size() as i64,
    })
}

#[napi]
pub async fn hash_file_xxh3(path: String) -> Result<FileHashResult> {
    tokio::task::spawn_blocking(move || hash_file_sync(&path))
        .await
        .map_err(|e| Error::new(Status::GenericFailure, format!("Task join error: {e}")))?
}

#[napi]
pub async fn hash_files_xxh3(paths: Vec<String>) -> Result<Vec<FileHashResult>> {
    tokio::task::spawn_blocking(move || {
        paths
            .par_iter()
            .map(|p| hash_file_sync(p))
            .collect::<Result<Vec<_>>>()
    })
    .await
    .map_err(|e| Error::new(Status::GenericFailure, format!("Task join error: {e}")))?
}
