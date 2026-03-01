use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi]
pub struct StreamHasherXxh3 {
    inner: xxhash_rust::xxh3::Xxh3,
}

#[napi]
impl StreamHasherXxh3 {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            inner: xxhash_rust::xxh3::Xxh3::new(),
        }
    }

    #[napi]
    pub fn update(&mut self, chunk: Buffer) {
        self.inner.update(&chunk);
    }

    #[napi]
    pub fn digest(&self) -> String {
        format!("{:032x}", self.inner.digest128())
    }
}
