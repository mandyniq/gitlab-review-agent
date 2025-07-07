const winston = require('winston');

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(errors({ stack: true }), timestamp(), json()),
  defaultMeta: { service: 'gitlab-code-review-agent' },
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), simple()),
    })
  );
}

/**
 * Log API request details
 * @param {Object} req - Express request object
 * @param {string} action - Description of the action being performed
 */
const logAPIRequest = (req, action) => {
  logger.info('API Request', {
    action,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log GitLab API calls
 * @param {string} endpoint - GitLab API endpoint
 * @param {string} method - HTTP method
 * @param {number} statusCode - Response status code
 * @param {number} duration - Request duration in ms
 */
const logGitLabAPICall = (endpoint, method, statusCode, duration) => {
  logger.info('GitLab API Call', {
    endpoint,
    method,
    statusCode,
    duration,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log OpenAI API calls
 * @param {string} model - OpenAI model used
 * @param {number} tokensUsed - Number of tokens consumed
 * @param {number} duration - Request duration in ms
 */
const logOpenAICall = (model, tokensUsed, duration) => {
  logger.info('OpenAI API Call', {
    model,
    tokensUsed,
    duration,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  logger,
  logAPIRequest,
  logGitLabAPICall,
  logOpenAICall,
};
