export class ServiceError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ServiceError";
    this.statusCode = statusCode;
  }
}

export function isConflictError(error) {
  return error?.name === "TransactionCanceledException";
}
