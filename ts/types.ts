export type Algorithm = "blake3" | "xxh3";

export interface Options {
  algorithm?: Algorithm;
}

export interface FileHashOptions extends Options {
  mmap?: boolean;
}

export interface MatchResult {
  matches: boolean;
  hash: string;
  size: number;
}

export interface HashAlgo {
  file(path: string, options?: { mmap?: boolean }): Promise<{ hash: string; size: number }>;
  files(paths: string[]): Promise<{ hash: string; size: number }[]>;
  buffer(data: Buffer): Promise<string>;
  createStreamHasher(): { update(chunk: Buffer): void; digest(): string };
}
