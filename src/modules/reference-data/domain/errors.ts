export class ReferenceDataError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ReferenceDataError";
  }
}
