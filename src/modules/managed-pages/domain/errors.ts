export class ManagedPageError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ManagedPageError";
  }
}
