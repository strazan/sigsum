import { hashBuffer, hashFile, hashFiles, StreamHasher } from "../native.cjs";
import type { HashAlgo } from "../types.js";

export const blake3: HashAlgo = {
  file: (path, options) => hashFile(path, options),
  files: hashFiles,
  buffer: hashBuffer,
  createStreamHasher: () => new StreamHasher(),
};
