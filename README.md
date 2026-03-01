# sigsum

Fast file hashing for Node.js. BLAKE3 by default, XXH3 when you want max speed, native Rust performance.

Detect duplicate uploads, verify file integrity, content-address your storage. Single API, two algorithms, prebuilt binaries, zero node-gyp.

Under the hood: Rust + napi-rs native bindings, rayon-parallelized BLAKE3, mmap for large files, batch API with parallel file hashing.

## Install

```bash
pnpm add sigsum
```

## Usage

```ts
import { sigsum } from "sigsum";

// Hash a file (mmap + rayon for large files)
const hash = await sigsum.file("/path/to/file.pdf");
// → "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262"

// Hash a buffer
const hash = await sigsum.buffer(data);

// Hash a stream (e.g., upload before writing to disk)
const hash = await sigsum.stream(readableStream);

// Compare two hashes
sigsum.compare(hashA, hashB); // true/false

// Hash + compare in one call (auto-detects algorithm from hash length)
const result = await sigsum.match("/path/to/file.pdf", expectedHash);
// → { matches: true, hash: "af13...", size: 1048576 }
```

### Batch hashing

Hash many files in a single native call. Rayon distributes files across cores — no NAPI overhead per file.

```ts
const hashes = await sigsum.files([
  "/uploads/a.pdf",
  "/uploads/b.png",
  "/uploads/c.mp4",
]);
```

### XXH3 (fast mode)

When you don't need cryptographic collision resistance — duplicate detection, cache keys, content addressing with trusted inputs.

```ts
// 2.5x faster than BLAKE3, outputs 32-char hex (128-bit)
const hash = await sigsum.file(path, { algorithm: "xxh3" });

// Works everywhere: buffer, stream, batch
await sigsum.buffer(data, { algorithm: "xxh3" });
await sigsum.stream(readable, { algorithm: "xxh3" });
await sigsum.files(paths, { algorithm: "xxh3" });
```

### Algorithm detection

The algorithm is encoded in the hash length — 64 hex chars = BLAKE3, 32 hex chars = XXH3.

```ts
sigsum.detectAlgorithm(hash); // → "blake3" | "xxh3"

// match() auto-detects — pass any hash and it uses the right algorithm
await sigsum.match(path, blake3Hash); // uses BLAKE3
await sigsum.match(path, xxh3Hash);   // uses XXH3
```

## Benchmarks

Measured on Apple M3 Pro, Node.js v24.

### Single file hashing

| Size | sigsum (BLAKE3) | sigsum (XXH3) | Node.js SHA-256 |
|------|-----------------|----------------|-----------------|
| 1 MB | 0.23ms | 0.11ms | 0.50ms |
| 10 MB | 1.0ms | 0.58ms | 4.9ms |
| 100 MB | 8.6ms | 9.0ms | 49ms |

### Batch — 100 x 3 MB files (300 MB total)

| Method | Mean | vs Node.js |
|--------|------|-----------|
| **sigsum xxh3 batch** | **10.4ms** | **15.3x** |
| sigsum blake3 batch | 26.3ms | 6.0x |
| Node.js SHA-256 sequential | 159ms | 1x |

Run benchmarks yourself:

```bash
pnpm bench
```

## How it works

- **BLAKE3** (default): Cryptographic hash with built-in tree structure for rayon parallelism. Files > 1 MB are memory-mapped. 64-char lowercase hex output, fits in `VARCHAR(64)`
- **XXH3-128**: Non-cryptographic hash optimized for throughput. Single-threaded per file, parallelized across files via rayon `par_iter`. 32-char lowercase hex output
- **Batch API**: Single NAPI boundary crossing for N files. Rayon distributes work across cores inside Rust — no JS event loop involvement
- **Algorithm detection**: Hash length distinguishes algorithms (64 = BLAKE3, 32 = XXH3). `match()` auto-selects the right algorithm
- **Streaming**: NAPI class with `update(chunk)` / `digest()` for hashing upload streams before writing to disk
