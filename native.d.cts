export declare class StreamHasher {
  constructor();
  update(chunk: Buffer): void;
  digest(): string;
}

export declare class StreamHasherXxh3 {
  constructor();
  update(chunk: Buffer): void;
  digest(): string;
}

export interface FileHashOptions {
  mmap?: boolean;
}

export interface FileHashResult {
  hash: string;
  size: number;
}

export declare function hashBuffer(data: Buffer): Promise<string>;

export declare function hashBufferXxh3(data: Buffer): Promise<string>;

export declare function hashFile(
  path: string,
  options?: FileHashOptions | undefined | null,
): Promise<FileHashResult>;

export declare function hashFiles(paths: string[]): Promise<FileHashResult[]>;

export declare function hashFileXxh3(path: string): Promise<FileHashResult>;

export declare function hashFilesXxh3(paths: string[]): Promise<FileHashResult[]>;
