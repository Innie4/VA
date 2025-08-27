import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { PrismaClientKnownRequestError, PrismaClientUnknownRequestError, PrismaClientRustPanicError, PrismaClientInitializationError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { ValidationError } from 'joi';

// Custom error class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string | undefined;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    code?: string | undefined
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  message: string;
  error?: {
    code?: string | undefined;
    details?: any;
    stack?: string | undefined;
  };
  timestamp: string;
  path: string;
  method: string;
}

// Handle Prisma errors
const handlePrismaError = (error: any): AppError => {
  if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return new AppError(
          'A record with this information already exists',
          409,
          true,
          'DUPLICATE_RECORD'
        );
      case 'P2025':
        return new AppError(
          'Record not found',
          404,
          true,
          'RECORD_NOT_FOUND'
        );
      case 'P2003':
        return new AppError(
          'Foreign key constraint failed',
          400,
          true,
          'FOREIGN_KEY_CONSTRAINT'
        );
      case 'P2014':
        return new AppError(
          'Invalid ID provided',
          400,
          true,
          'INVALID_ID'
        );
      default:
        return new AppError(
          'Database operation failed',
          500,
          true,
          'DATABASE_ERROR'
        );
    }
  }

  if (error instanceof PrismaClientUnknownRequestError) {
    return new AppError(
      'Unknown database error occurred',
      500,
      true,
      'UNKNOWN_DATABASE_ERROR'
    );
  }

  if (error instanceof PrismaClientRustPanicError) {
    return new AppError(
      'Database connection error',
      500,
      false,
      'DATABASE_CONNECTION_ERROR'
    );
  }

  if (error instanceof PrismaClientInitializationError) {
    return new AppError(
      'Database initialization error',
      500,
      false,
      'DATABASE_INIT_ERROR'
    );
  }

  if (error instanceof PrismaClientValidationError) {
    return new AppError(
      'Invalid data provided',
      400,
      true,
      'VALIDATION_ERROR'
    );
  }

  return new AppError('Database error', 500, true, 'DATABASE_ERROR');
};

// Handle JWT errors
const handleJWTError = (error: JsonWebTokenError | TokenExpiredError): AppError => {
  if (error instanceof TokenExpiredError) {
    return new AppError(
      'Token has expired',
      401,
      true,
      'TOKEN_EXPIRED'
    );
  }

  return new AppError(
    'Invalid token',
    401,
    true,
    'INVALID_TOKEN'
  );
};

// Handle Joi validation errors
const handleValidationError = (error: ValidationError): AppError => {
  const message = error.details.map(detail => detail.message).join(', ');
  return new AppError(
    `Validation error: ${message}`,
    400,
    true,
    'VALIDATION_ERROR'
  );
};

// Handle different error types
const handleError = (error: any): AppError => {
  // If it's already an AppError, return as is
  if (error instanceof AppError) {
    return error;
  }

  // Handle Prisma errors
  if (error.name?.includes('Prisma') || error instanceof PrismaClientKnownRequestError) {
    return handlePrismaError(error);
  }

  // Handle JWT errors
  if (error instanceof JsonWebTokenError || error instanceof TokenExpiredError) {
    return handleJWTError(error);
  }

  // Handle Joi validation errors
  if (error.isJoi || error.name === 'ValidationError') {
    return handleValidationError(error);
  }

  // Handle specific Node.js errors
  if (error.code === 'ENOENT') {
    return new AppError(
      'File not found',
      404,
      true,
      'FILE_NOT_FOUND'
    );
  }

  if (error.code === 'EACCES') {
    return new AppError(
      'Permission denied',
      403,
      true,
      'PERMISSION_DENIED'
    );
  }

  if (error.code === 'EMFILE' || error.code === 'ENFILE') {
    return new AppError(
      'Too many open files',
      503,
      false,
      'TOO_MANY_FILES'
    );
  }

  // Handle syntax errors
  if (error instanceof SyntaxError) {
    return new AppError(
      'Invalid JSON format',
      400,
      true,
      'INVALID_JSON'
    );
  }

  // Handle type errors
  if (error instanceof TypeError) {
    return new AppError(
      'Invalid data type',
      400,
      true,
      'INVALID_TYPE'
    );
  }

  // Default error
  return new AppError(
    error.message || 'Internal server error',
    error.statusCode || 500,
    false,
    'INTERNAL_ERROR'
  );
};

// Send error response
const sendErrorResponse = (error: AppError, req: Request, res: Response) => {
  const errorResponse: ErrorResponse = {
    success: false,
    message: error.message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };

  // Add error details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error = {
      ...(error.code && { code: error.code }),
      ...(error.stack && { stack: error.stack }),
    };
  } else if (error.code) {
    errorResponse.error = {
      code: error.code,
    };
  }

  res.status(error.statusCode).json(errorResponse);
};

// Main error handler middleware
export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Handle the error
  const appError = handleError(error);

  // Log the error
  if (appError.isOperational) {
    logger.warn('Operational Error', {
      message: appError.message,
      statusCode: appError.statusCode,
      code: appError.code,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
    });
  } else {
    logger.error('Programming Error', {
      message: appError.message,
      stack: appError.stack,
      statusCode: appError.statusCode,
      code: appError.code,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
    });
  }

  // Send error response
  sendErrorResponse(appError, req, res);
};

// Async error wrapper
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    true,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

// Validation error helper
export const createValidationError = (message: string, field?: string) => {
  return new AppError(
    message,
    400,
    true,
    field ? `VALIDATION_ERROR_${field.toUpperCase()}` : 'VALIDATION_ERROR'
  );
};

// Authorization error helper
export const createAuthError = (message: string = 'Unauthorized') => {
  return new AppError(message, 401, true, 'UNAUTHORIZED');
};

// Forbidden error helper
export const createForbiddenError = (message: string = 'Forbidden') => {
  return new AppError(message, 403, true, 'FORBIDDEN');
};

// Not found error helper
export const createNotFoundError = (resource: string = 'Resource') => {
  return new AppError(`${resource} not found`, 404, true, 'NOT_FOUND');
};

// Conflict error helper
export const createConflictError = (message: string) => {
  return new AppError(message, 409, true, 'CONFLICT');
};

// Rate limit error helper
export const createRateLimitError = (message: string = 'Too many requests') => {
  return new AppError(message, 429, true, 'RATE_LIMIT_EXCEEDED');
};

export default errorHandler;