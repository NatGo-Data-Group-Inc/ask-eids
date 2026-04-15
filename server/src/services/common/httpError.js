export class HttpError extends Error {
  constructor(status, code, message, options = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = options.field ?? null;
    this.retryable = options.retryable ?? false;
  }
}
