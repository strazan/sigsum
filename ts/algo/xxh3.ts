import { hashBufferXxh3, hashFilesXxh3, hashFileXxh3, StreamHasherXxh3 } from "../../native.cjs";
import type { HashAlgo } from "../types.js";

export const xxh3: HashAlgo = {
  file: (path) => hashFileXxh3(path),
  files: hashFilesXxh3,
  buffer: hashBufferXxh3,
  createStreamHasher: () => new StreamHasherXxh3(),
};
