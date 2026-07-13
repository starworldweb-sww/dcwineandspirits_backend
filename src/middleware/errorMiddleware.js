import { HttpError } from "../utils/httpError.js";

export function errorMiddleware(error, _req, res, _next) {
  const statusCode =
    error instanceof HttpError
      ? error.statusCode
      : Number.isInteger(error?.statusCode)
        ? error.statusCode
        : 500;

  if (statusCode >= 500) {
    console.error("Unhandled error:", error);
  }

  res.status(statusCode).json({
    success: false,
    message: error?.message || "Internal server error",
  });
}
