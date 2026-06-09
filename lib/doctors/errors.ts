export const DUPLICATE_NPI_MESSAGE =
  "This NPI is already associated with another account. If this is an error, please contact support.";

export class DuplicateNpiError extends Error {
  statusCode = 409;

  constructor() {
    super(DUPLICATE_NPI_MESSAGE);
    this.name = "DuplicateNpiError";
  }
}
