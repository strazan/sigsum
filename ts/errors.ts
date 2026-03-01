export class SighashError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SighashError";
  }
}

export class FileNotFoundError extends SighashError {
  constructor(path: string, options?: ErrorOptions) {
    super(`File not found: ${path}`, options);
    this.name = "FileNotFoundError";
  }
}

export function toSighashError(err: unknown): SighashError | FileNotFoundError {
  if (err instanceof Error && err.message.startsWith("ENOENT: ")) {
    return new FileNotFoundError(err.message.slice("ENOENT: ".length), { cause: err });
  }
  return new SighashError(err instanceof Error ? err.message : String(err), {
    cause: err instanceof Error ? err : undefined,
  });
}
