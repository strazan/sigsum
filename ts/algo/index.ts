import { SighashError } from "../errors.js";
import type { Algorithm, HashAlgo } from "../types.js";
import { blake3 } from "./blake3.js";
import { xxh3 } from "./xxh3.js";

const algos: Record<Algorithm, HashAlgo> = { blake3, xxh3 };

export const getAlgo = (algorithm: Algorithm = "blake3"): HashAlgo => algos[algorithm];

export const detectAlgorithm = (hash: string): Algorithm => {
  if (hash.length === 64) return "blake3";
  if (hash.length === 32) return "xxh3";
  throw new SighashError(`Cannot detect algorithm from hash length ${hash.length}`);
};
