const { gitlabService } = require('../services/gitlabService');
const { logger } = require('../utils/logger');

/**
 * Middleware to authenticate GitLab tokens directly
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticateGitLabToken = async (req, res, next) => {
  const gitlabToken = req.headers['private-token'];

  if (!gitlabToken) {
    logger.warn('Authentication attempt without GitLab token', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    return res.status(401).json({
      error: 'GitLab token required in PRIVATE-TOKEN header',
      code: 'TOKEN_MISSING',
    });
  }

  // Just pass the token through - GitLab API will validate it on actual use
  req.gitlabToken = gitlabToken;

  logger.debug('GitLab token added to request');

  next();
};

/**
 * Middleware to check if user has required scopes (placeholder for future use)
 * @param {Array} requiredScopes - Array of required GitLab scopes
 */
const requireScopes = (requiredScopes) => {
  return (req, res, next) => {
    // For now, just pass through since GitLab tokens have their own scope validation
    // This can be enhanced later if needed
    next();
  };
};

module.exports = {
  authenticateGitLabToken,
  requireScopes,
};
