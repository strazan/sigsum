import { createReadStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FileNotFoundError, SighashError, sighash } from "../dist/index.js";

// BLAKE3 hash of empty input
const EMPTY_HASH = "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262";

let tempDir: string;
let smallFilePath: string;
let largeFilePath: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "sighash-test-"));

  // Small file (< 128KB)
  smallFilePath = join(tempDir, "small.txt");
  await writeFile(smallFilePath, "hello world");

  // Large file (> 1MB, triggers mmap + rayon)
  largeFilePath = join(tempDir, "large.bin");
  const largeData = Buffer.alloc(2 * 1024 * 1024, 0xab);
  await writeFile(largeFilePath, largeData);
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("buffer", () => {
  it("hashes an empty buffer", async () => {
    const hash = await sighash.buffer(Buffer.alloc(0));
    expect(hash).toBe(EMPTY_HASH);
    expect(hash).toHaveLength(64);
  });

  it("hashes a small buffer", async () => {
    const hash = await sighash.buffer(Buffer.from("hello world"));
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces consistent hashes", async () => {
    const data = Buffer.from("deterministic");
    const hash1 = await sighash.buffer(data);
    const hash2 = await sighash.buffer(data);
    expect(hash1).toBe(hash2);
  });

  it("hashes a Uint8Array", async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const hash = await sighash.buffer(data);
    expect(hash).toHaveLength(64);
  });

  it("hashes a large buffer (rayon path)", async () => {
    const data = Buffer.alloc(256 * 1024, 0xff);
    const hash = await sighash.buffer(data);
    expect(hash).toHaveLength(64);
  });
});

describe("compare", () => {
  it("returns true for equal hashes", () => {
    const hash = "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262";
    expect(sighash.compare(hash, hash)).toBe(true);
  });

  it("returns false for different hashes", () => {
    const a = "af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262";
    const b = "0000000000000000000000000000000000000000000000000000000000000000";
    expect(sighash.compare(a, b)).toBe(false);
  });

  it("returns false for different lengths", () => {
    expect(sighash.compare("abc", "abcd")).toBe(false);
  });
});

describe("file", () => {
  it("hashes a small file", async () => {
    const hash = await sighash.file(smallFilePath);
    expect(hash).toHaveLength(64);

    // Should match buffer hash of same content
    const bufferHash = await sighash.buffer(Buffer.from("hello world"));
    expect(hash).toBe(bufferHash);
  });

  it("hashes a large file (mmap path)", async () => {
    const hash = await sighash.file(largeFilePath);
    expect(hash).toHaveLength(64);

    // Should match buffer hash of same content
    const largeData = Buffer.alloc(2 * 1024 * 1024, 0xab);
    const bufferHash = await sighash.buffer(largeData);
    expect(hash).toBe(bufferHash);
  });

  it("respects mmap: false option", async () => {
    const hashDefault = await sighash.file(largeFilePath);
    const hashNoMmap = await sighash.file(largeFilePath, { mmap: false });
    expect(hashDefault).toBe(hashNoMmap);
  });

  it("throws FileNotFoundError for missing file", async () => {
    await expect(sighash.file("/nonexistent/path/file.txt")).rejects.toThrow(FileNotFoundError);
  });
});

describe("files (batch)", () => {
  it("hashes multiple files in one call", async () => {
    const hashes = await sighash.files([smallFilePath, largeFilePath]);
    expect(hashes).toHaveLength(2);
    expect(hashes[0]).toBe(await sighash.file(smallFilePath));
    expect(hashes[1]).toBe(await sighash.file(largeFilePath));
  });

  it("hashes an empty array", async () => {
    const hashes = await sighash.files([]);
    expect(hashes).toHaveLength(0);
  });

  it("throws on missing file in batch", async () => {
    await expect(sighash.files([smallFilePath, "/nonexistent/file"])).rejects.toThrow(SighashError);
  });
});

describe("stream", () => {
  it("hashes a file stream", async () => {
    const stream = createReadStream(smallFilePath);
    const hash = await sighash.stream(stream);
    expect(hash).toHaveLength(64);

    // Must match file hash
    const fileHash = await sighash.file(smallFilePath);
    expect(hash).toBe(fileHash);
  });

  it("hashes a large file stream", async () => {
    const stream = createReadStream(largeFilePath);
    const hash = await sighash.stream(stream);

    const fileHash = await sighash.file(largeFilePath);
    expect(hash).toBe(fileHash);
  });

  it("hashes an empty stream", async () => {
    const stream = Readable.from([]);
    const hash = await sighash.stream(stream);
    expect(hash).toBe(EMPTY_HASH);
  });

  it("hashes a synthetic stream", async () => {
    const chunks = [Buffer.from("hello"), Buffer.from(" "), Buffer.from("world")];
    const stream = Readable.from(chunks);
    const hash = await sighash.stream(stream);

    const bufferHash = await sighash.buffer(Buffer.from("hello world"));
    expect(hash).toBe(bufferHash);
  });

  it("stream matches file for any file", async () => {
    const streamHash = await sighash.stream(createReadStream(largeFilePath));
    const fileHash = await sighash.file(largeFilePath);
    expect(streamHash).toBe(fileHash);
  });
});

describe("match", () => {
  it("returns matches: true for correct hash", async () => {
    const hash = await sighash.file(smallFilePath);
    const result = await sighash.match(smallFilePath, hash);

    expect(result.matches).toBe(true);
    expect(result.hash).toBe(hash);
    expect(result.size).toBeGreaterThan(0);
  });

  it("returns matches: false for wrong hash", async () => {
    const wrongHash = "0000000000000000000000000000000000000000000000000000000000000000";
    const result = await sighash.match(smallFilePath, wrongHash);

    expect(result.matches).toBe(false);
    expect(result.hash).not.toBe(wrongHash);
    expect(result.size).toBeGreaterThan(0);
  });

  it("throws FileNotFoundError for missing file", async () => {
    await expect(sighash.match("/nonexistent/file", EMPTY_HASH)).rejects.toThrow(FileNotFoundError);
  });

  it("returns correct size", async () => {
    const result = await sighash.match(smallFilePath, EMPTY_HASH);
    expect(result.size).toBe(11); // "hello world" = 11 bytes
  });
});

describe("xxh3 algorithm", () => {
  it("buffer produces 32-char hex hash", async () => {
    const hash = await sighash.buffer(Buffer.from("hello world"), { algorithm: "xxh3" });
    expect(hash).toHaveLength(32);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("buffer is consistent", async () => {
    const data = Buffer.from("deterministic");
    const h1 = await sighash.buffer(data, { algorithm: "xxh3" });
    const h2 = await sighash.buffer(data, { algorithm: "xxh3" });
    expect(h1).toBe(h2);
  });

  it("buffer differs from blake3", async () => {
    const data = Buffer.from("hello world");
    const blake3Hash = await sighash.buffer(data);
    const xxh3Hash = await sighash.buffer(data, { algorithm: "xxh3" });
    expect(blake3Hash).not.toBe(xxh3Hash);
    expect(blake3Hash).toHaveLength(64);
    expect(xxh3Hash).toHaveLength(32);
  });

  it("file produces 32-char hex hash", async () => {
    const hash = await sighash.file(smallFilePath, { algorithm: "xxh3" });
    expect(hash).toHaveLength(32);
  });

  it("file matches buffer for same content", async () => {
    const fileHash = await sighash.file(smallFilePath, { algorithm: "xxh3" });
    const bufferHash = await sighash.buffer(Buffer.from("hello world"), { algorithm: "xxh3" });
    expect(fileHash).toBe(bufferHash);
  });

  it("files batch works", async () => {
    const hashes = await sighash.files([smallFilePath, largeFilePath], { algorithm: "xxh3" });
    expect(hashes).toHaveLength(2);
    expect(hashes[0]).toHaveLength(32);
    expect(hashes[1]).toHaveLength(32);
    expect(hashes[0]).toBe(await sighash.file(smallFilePath, { algorithm: "xxh3" }));
  });

  it("stream matches file", async () => {
    const streamHash = await sighash.stream(createReadStream(smallFilePath), {
      algorithm: "xxh3",
    });
    const fileHash = await sighash.file(smallFilePath, { algorithm: "xxh3" });
    expect(streamHash).toBe(fileHash);
  });

  it("stream matches file for large file", async () => {
    const streamHash = await sighash.stream(createReadStream(largeFilePath), {
      algorithm: "xxh3",
    });
    const fileHash = await sighash.file(largeFilePath, { algorithm: "xxh3" });
    expect(streamHash).toBe(fileHash);
  });

  it("match auto-detects xxh3 from 32-char hash", async () => {
    const hash = await sighash.file(smallFilePath, { algorithm: "xxh3" });
    const result = await sighash.match(smallFilePath, hash);
    expect(result.matches).toBe(true);
    expect(result.hash).toHaveLength(32);
  });

  it("match auto-detects blake3 from 64-char hash", async () => {
    const hash = await sighash.file(smallFilePath);
    const result = await sighash.match(smallFilePath, hash);
    expect(result.matches).toBe(true);
    expect(result.hash).toHaveLength(64);
  });

  it("compare works with xxh3 hashes", () => {
    const a = "0".repeat(32);
    const b = "0".repeat(32);
    expect(sighash.compare(a, b)).toBe(true);
  });
});

describe("detectAlgorithm", () => {
  it("detects blake3 from 64-char hash", () => {
    expect(sighash.detectAlgorithm("a".repeat(64))).toBe("blake3");
  });

  it("detects xxh3 from 32-char hash", () => {
    expect(sighash.detectAlgorithm("a".repeat(32))).toBe("xxh3");
  });

  it("throws for unknown length", () => {
    expect(() => sighash.detectAlgorithm("abc")).toThrow(SighashError);
  });
});

describe("error types", () => {
  it("SighashError is an Error", () => {
    const err = new SighashError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SighashError);
    expect(err.name).toBe("SighashError");
  });

  it("FileNotFoundError extends SighashError", () => {
    const err = new FileNotFoundError("/test");
    expect(err).toBeInstanceOf(SighashError);
    expect(err).toBeInstanceOf(FileNotFoundError);
    expect(err.name).toBe("FileNotFoundError");
  });
});
