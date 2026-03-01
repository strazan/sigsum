use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi]
pub struct StreamHasher {
    inner: blake3::Hasher,
}

#[napi]
impl StreamHasher {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            inner: blake3::Hasher::new(),
        }
    }

    #[napi]
    pub fn update(&mut self, chunk: Buffer) {
        self.inner.update(&chunk);
    }

    #[napi]
    pub fn digest(&self) -> String {
        self.inner.finalize().to_hex().to_string()
    }
}
