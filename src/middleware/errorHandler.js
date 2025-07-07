const { logger } = require('../utils/logger');

/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Application error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
  });

  // Default error response
  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
    code = 'UNAUTHORIZED';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    message = 'Forbidden';
    code = 'FORBIDDEN';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Resource not found';
    code = 'NOT_FOUND';
  } else if (err.name === 'GitLabAPIError') {
    statusCode = 502;
    message = 'GitLab API error';
    code = 'GITLAB_API_ERROR';
  } else if (err.name === 'OpenAIAPIError') {
    statusCode = 502;
    message = 'AI service error';
    code = 'AI_SERVICE_ERROR';
  } else if (err.name === 'RateLimitError') {
    statusCode = 429;
    message = 'Rate limit exceeded';
    code = 'RATE_LIMIT_EXCEEDED';
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
  }

  res.status(statusCode).json({
    error: message,
    code,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

/**
 * Handle async errors in route handlers
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Custom error classes
 */
class GitLabAPIError extends Error {
  constructor(message, statusCode, response) {
    super(message);
    this.name = 'GitLabAPIError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

class OpenAIAPIError extends Error {
  constructor(message, statusCode, response) {
    super(message);
    this.name = 'OpenAIAPIError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  GitLabAPIError,
  OpenAIAPIError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
};
