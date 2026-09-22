export type ApiErrorCode =
  | "CONFIG_ERROR"
  | "GOOGLE_AUTH_ERROR"
  | "MASTER_NOT_FOUND"
  | "SUBMISSION_NOT_FOUND"
  | "SUBMISSION_ALREADY_EXISTS"
  | "DUPLICATE_SUBMISSION"
  | "DUPLICATE_MASTER"
  | "INVALID_REQUEST"
  | "SHEET_HEADER_ERROR"
  | "SHEET_DATA_ERROR"
  | "SHEETS_READ_ERROR"
  | "SHEETS_WRITE_ERROR"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly publicMessage: string;

  constructor(
    code: ApiErrorCode,
    status: number,
    message: string,
    publicMessage = message,
    options?: { cause?: unknown },
  ) {
    super(message);
    if (options && "cause" in options) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        value: options.cause,
        writable: true,
      });
    }
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

export interface PublicApiError {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export const toPublicApiError = (error: unknown): { status: number; body: PublicApiError } => {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.publicMessage } },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi gangguan pada server. Silakan coba kembali.",
      },
    },
  };
};
