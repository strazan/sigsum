import type { Readable } from "node:stream";
import { detectAlgorithm, getAlgo } from "./algo/index.js";
import { SighashError, toSighashError } from "./errors.js";
import type { FileHashOptions, MatchResult, Options } from "./types.js";

async function withErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw toSighashError(err);
  }
}

const file = (path: string, options?: FileHashOptions): Promise<string> =>
  withErrors(async () => (await getAlgo(options?.algorithm).file(path, options)).hash);

const files = (paths: string[], options?: Options): Promise<string[]> =>
  withErrors(async () => (await getAlgo(options?.algorithm).files(paths)).map((r) => r.hash));

const buffer = (data: Buffer | Uint8Array, options?: Options): Promise<string> =>
  withErrors(() => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    return getAlgo(options?.algorithm).buffer(buf);
  });

const stream = (readable: Readable, options?: Options): Promise<string> => {
  const hasher = getAlgo(options?.algorithm).createStreamHasher();

  return new Promise<string>((resolve, reject) => {
    readable.on("data", (chunk: Buffer | Uint8Array) => {
      try {
        hasher.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      } catch (err) {
        readable.destroy();
        reject(toSighashError(err));
      }
    });

    readable.on("end", () => {
      try {
        resolve(hasher.digest());
      } catch (err) {
        reject(toSighashError(err));
      }
    });

    readable.on("error", (err) => {
      reject(new SighashError(`Stream error: ${err.message}`, { cause: err }));
    });
  });
};

const compare = (a: string, b: string): boolean => a === b;

const match = (path: string, expectedHash: string): Promise<MatchResult> =>
  withErrors(async () => {
    const result = await getAlgo(detectAlgorithm(expectedHash)).file(path);
    return {
      matches: result.hash === expectedHash,
      hash: result.hash,
      size: result.size,
    };
  });

export const sighash = {
  file,
  files,
  buffer,
  stream,
  compare,
  match,
  detectAlgorithm,
};
