export class GhlServiceError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = "GhlServiceError";
    this.statusCode = statusCode;
  }
}
