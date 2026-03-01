use napi_derive::napi;
use std::path::Path;
use std::{fs, io};

/// Minimum file size before preferring memory-mapped I/O.
pub const MMAP_THRESHOLD: u64 = 1024 * 1024; // 1 MB

/// Minimum buffer size before enabling rayon parallelism for BLAKE3.
pub const RAYON_THRESHOLD: usize = 128 * 1024; // 128 KB

#[derive(Debug, thiserror::Error)]
pub enum SigsumError {
    #[error("ENOENT: {0}")]
    NotFound(String),

    #[error("{0}")]
    Io(#[from] io::Error),
}

impl From<SigsumError> for napi::Error {
    fn from(err: SigsumError) -> Self {
        napi::Error::new(napi::Status::GenericFailure, err.to_string())
    }
}

#[napi(object)]
pub struct FileHashOptions {
    pub mmap: Option<bool>,
}

#[napi(object)]
pub struct FileHashResult {
    pub hash: String,
    pub size: i64,
}

/// File contents loaded either via mmap or a heap buffer.
pub enum FileData {
    Mmap(memmap2::Mmap, u64),
    Buf(Vec<u8>, u64),
}

impl FileData {
    /// Returns the file contents as a byte slice.
    pub fn as_bytes(&self) -> &[u8] {
        match self {
            Self::Mmap(mmap, _) => mmap,
            Self::Buf(buf, _) => buf,
        }
    }

    /// Returns the file size in bytes.
    pub fn size(&self) -> u64 {
        match self {
            Self::Mmap(_, size) | Self::Buf(_, size) => *size,
        }
    }
}

/// Open a file and return either an mmap or a heap buffer.
pub fn read_file(path: &str, force_mmap: Option<bool>) -> Result<FileData, SigsumError> {
    let file_path = Path::new(path);

    let metadata = fs::metadata(file_path).map_err(|e| {
        if e.kind() == io::ErrorKind::NotFound {
            SigsumError::NotFound(path.to_owned())
        } else {
            SigsumError::Io(e)
        }
    })?;

    let size = metadata.len();
    let use_mmap = force_mmap.unwrap_or(size >= MMAP_THRESHOLD);

    if use_mmap && size > 0 {
        let file = fs::File::open(file_path)?;
        // SAFETY: The file handle is held open for the lifetime of the mmap.
        // Concurrent modification of the underlying file is undefined behavior.
        let mmap = unsafe { memmap2::Mmap::map(&file)? };
        Ok(FileData::Mmap(mmap, size))
    } else {
        let data = fs::read(file_path)?;
        Ok(FileData::Buf(data, size))
    }
}
