use crate::common::{read_file, FileData, FileHashOptions, FileHashResult, RAYON_THRESHOLD};
use napi::bindgen_prelude::*;
use napi_derive::napi;
use rayon::prelude::*;

#[inline]
fn hash_file_sync(path: &str, force_mmap: Option<bool>, use_rayon: bool) -> Result<FileHashResult> {
    let file_data = read_file(path, force_mmap)?;

    let hash_hex = match &file_data {
        FileData::Mmap(mmap, _) => {
            let mut hasher = blake3::Hasher::new();
            if use_rayon {
                hasher.update_rayon(mmap);
            } else {
                hasher.update(mmap);
            }
            hasher.finalize().to_hex().to_string()
        }
        FileData::Buf(data, _) => {
            if use_rayon && data.len() >= RAYON_THRESHOLD {
                let mut hasher = blake3::Hasher::new();
                hasher.update_rayon(data);
                hasher.finalize().to_hex().to_string()
            } else {
                blake3::hash(data).to_hex().to_string()
            }
        }
    };

    Ok(FileHashResult {
        hash: hash_hex,
        size: file_data.size() as i64,
    })
}

#[napi]
pub async fn hash_file(path: String, options: Option<FileHashOptions>) -> Result<FileHashResult> {
    let force_mmap = options.and_then(|o| o.mmap);
    tokio::task::spawn_blocking(move || hash_file_sync(&path, force_mmap, true))
        .await
        .map_err(|e| Error::new(Status::GenericFailure, format!("Task join error: {e}")))?
}

/// Each file is hashed single-threaded to avoid nested rayon contention;
/// parallelism comes from distributing files across cores.
#[napi]
pub async fn hash_files(paths: Vec<String>) -> Result<Vec<FileHashResult>> {
    tokio::task::spawn_blocking(move || {
        paths
            .par_iter()
            .map(|p| hash_file_sync(p, None, false))
            .collect::<Result<Vec<_>>>()
    })
    .await
    .map_err(|e| Error::new(Status::GenericFailure, format!("Task join error: {e}")))?
}
