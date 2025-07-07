const { logger } = require('../utils/logger');

/**
 * Validate GitLab Merge Request URL
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateMRUrl = (req, res, next) => {
  const { mrUrl } = req.body;

  if (!mrUrl) {
    return res.status(400).json({
      error: 'Merge Request URL is required',
      code: 'MR_URL_MISSING',
    });
  }

  // GitLab MR URL pattern: supports nested groups and custom domains
  // Examples:
  // https://gitlab.td.gfk.com/group/project/-/merge_requests/123
  // https://gitlab.td.gfk.com/ecosystem/platform-domain/microfrontends/design-system/-/merge_requests/760
  // https://gitlab.example.com/group/subgroup/project/-/merge_requests/456
  const gitlabMRPattern =
    /^https?:\/\/[^/]+\/[^/]+(?:\/[^/]+)*\/-\/merge_requests\/\d+$/;

  if (!gitlabMRPattern.test(mrUrl)) {
    logger.warn('Invalid MR URL format', {
      mrUrl,
      ip: req.ip,
    });

    return res.status(400).json({
      error: 'Invalid GitLab Merge Request URL format',
      code: 'INVALID_MR_URL',
      expected:
        'https://gitlab.td.gfk.com/group/project/-/merge_requests/123 or https://gitlab.td.gfk.com/ecosystem/platform-domain/microfrontends/design-system/-/merge_requests/760',
      actualUrl: mrUrl,
    });
  }

  // Extract MR details from URL - support nested groups
  const urlParts = mrUrl.match(
    /^(https?:\/\/[^/]+)\/(.*)\/-\/merge_requests\/(\d+)$/
  );
  if (urlParts) {
    req.mrDetails = {
      baseUrl: urlParts[1],
      projectPath: urlParts[2],
      mrIid: parseInt(urlParts[3], 10),
      fullUrl: mrUrl,
    };
  }

  next();
};

/**
 * Validate review feedback
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const validateReviewFeedback = (req, res, next) => {
  const { rating, feedback } = req.body;

  if (rating !== undefined) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'Rating must be an integer between 1 and 5',
        code: 'INVALID_RATING',
      });
    }
  }

  if (feedback !== undefined) {
    if (typeof feedback !== 'string' || feedback.trim().length === 0) {
      return res.status(400).json({
        error: 'Feedback must be a non-empty string',
        code: 'INVALID_FEEDBACK',
      });
    }

    if (feedback.length > 1000) {
      return res.status(400).json({
        error: 'Feedback must not exceed 1000 characters',
        code: 'FEEDBACK_TOO_LONG',
      });
    }
  }

  next();
};

/**
 * General request validation middleware
 * @param {Object} schema - Joi validation schema
 */
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);

    if (error) {
      logger.warn('Request validation failed', {
        error: error.details[0].message,
        path: req.path,
      });

      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.details[0].message,
      });
    }

    next();
  };
};

module.exports = {
  validateMRUrl,
  validateReviewFeedback,
  validateRequest,
};
