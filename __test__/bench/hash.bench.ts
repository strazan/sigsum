import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, bench, describe } from "vitest";
import { sighash } from "../../dist/index.js";
import { hashBufferXxh3, hashFilesXxh3, hashFileXxh3 } from "../../native.cjs";

let tempDir: string;
const files: Record<string, string> = {};
const buffers: Record<string, Buffer> = {};
const batchFiles: string[] = [];

const sizes = {
  "1KB": 1024,
  "64KB": 64 * 1024,
  "1MB": 1024 * 1024,
  "10MB": 10 * 1024 * 1024,
  "100MB": 100 * 1024 * 1024,
};

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), "sighash-bench-"));

  for (const [label, size] of Object.entries(sizes)) {
    const buf = Buffer.alloc(size, 0xab);
    const filePath = join(tempDir, `${label}.bin`);
    writeFileSync(filePath, buf);
    files[label] = filePath;
    buffers[label] = buf;
  }

  for (let i = 0; i < 100; i++) {
    const filePath = join(tempDir, `batch-${i}.bin`);
    writeFileSync(filePath, Buffer.alloc(3 * 1024 * 1024, i % 256));
    batchFiles.push(filePath);
  }
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function nodeSha256File(path: string): string {
  const data = readFileSync(path);
  return createHash("sha256").update(data).digest("hex");
}

function nodeSha256Buffer(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

describe("file hashing: blake3 vs xxh3 vs sha256", () => {
  for (const label of Object.keys(sizes)) {
    bench(`blake3 file (${label})`, async () => {
      await sighash.file(files[label]!);
    });

    bench(`xxh3 file (${label})`, async () => {
      await hashFileXxh3(files[label]!);
    });

    bench(`node sha256 file (${label})`, () => {
      nodeSha256File(files[label]!);
    });
  }
});

describe("buffer hashing: blake3 vs xxh3 vs sha256", () => {
  for (const label of Object.keys(sizes)) {
    bench(`blake3 buffer (${label})`, async () => {
      await sighash.buffer(buffers[label]!);
    });

    bench(`xxh3 buffer (${label})`, async () => {
      await hashBufferXxh3(buffers[label]!);
    });

    bench(`node sha256 buffer (${label})`, () => {
      nodeSha256Buffer(buffers[label]!);
    });
  }
});

describe("batch file hashing (100 x 3MB)", () => {
  bench("xxh3 batch (par_iter)", async () => {
    const results = await hashFilesXxh3(batchFiles);
    if (results.length !== 100) throw new Error("unexpected");
  });

  bench("blake3 batch (par_iter)", async () => {
    const results = await sighash.files(batchFiles);
    if (results.length !== 100) throw new Error("unexpected");
  });

  bench("blake3 x100 concurrent", async () => {
    const results = await Promise.all(batchFiles.map((f) => sighash.file(f)));
    if (results.length !== 100) throw new Error("unexpected");
  });

  bench("node sha256 x100 sequential", () => {
    for (const f of batchFiles) {
      nodeSha256File(f);
    }
  });
});
