export class SigsumError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SigsumError";
  }
}

export class FileNotFoundError extends SigsumError {
  constructor(path: string, options?: ErrorOptions) {
    super(`File not found: ${path}`, options);
    this.name = "FileNotFoundError";
  }
}

export function toSigsumError(err: unknown): SigsumError | FileNotFoundError {
  if (err instanceof Error && err.message.startsWith("ENOENT: ")) {
    return new FileNotFoundError(err.message.slice("ENOENT: ".length), { cause: err });
  }
  return new SigsumError(err instanceof Error ? err.message : String(err), {
    cause: err instanceof Error ? err : undefined,
  });
}
