import createHttpError from 'http-errors';
import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const httpError = createHttpError(error.status || 500, error.message, { expose: true });
  if (error.errors) {
    (httpError as any).errors = error.errors;
  }

  res.status(httpError.statusCode || 500).json({
    message: httpError.message,
    ...(httpError as any).errors ? { errors: (httpError as any).errors } : {}
  });
};
