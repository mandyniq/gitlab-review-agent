const { gitlabService } = require('../services/gitlabService');
const { openaiService } = require('../services/openaiService');
const { logger, logAPIRequest } = require('../utils/logger');
const {
  asyncHandler,
  NotFoundError,
  ValidationError,
} = require('../middleware/errorHandler');

// In-memory storage for review jobs (in production, use Redis or database)
const reviewJobs = new Map();

/**
 * Generate a unique job ID
 * @returns {string} Unique job ID
 */
const generateJobId = () => {
  return `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Analyze a GitLab Merge Request
 */
const analyzeMergeRequest = asyncHandler(async (req, res) => {
  logAPIRequest(req, 'Analyze Merge Request');

  const { mrUrl } = req.body;
  const { projectPath, mrIid, baseUrl } = req.mrDetails;

  // Create a job for tracking progress
  const jobId = generateJobId();
  reviewJobs.set(jobId, {
    id: jobId,
    status: 'processing',
    progress: 0,
    startTime: new Date(),
    mrUrl,
    projectPath,
    mrIid,
    baseUrl,
  });

  // Start async processing
  processReviewAsync(jobId, req.gitlabToken, projectPath, mrIid, baseUrl).catch(
    (error) => {
      logger.error('Review processing failed', {
        jobId,
        error: error.message,
      });

      reviewJobs.set(jobId, {
        ...reviewJobs.get(jobId),
        status: 'failed',
        error: error.message,
        endTime: new Date(),
      });
    }
  );

  logger.info('Review job started', {
    jobId,
    mrUrl,
  });

  res.status(202).json({
    message: 'Review analysis started',
    jobId,
    status: 'processing',
    estimatedTime: '1-2 minutes',
  });
});

/**
 * Process review asynchronously
 * @param {string} jobId - Job ID
 * @param {string} accessToken - GitLab access token
 * @param {string} projectPath - Project path
 * @param {number} mrIid - MR IID
 * @param {string} baseUrl - GitLab base URL
 */
async function processReviewAsync(
  jobId,
  accessToken,
  projectPath,
  mrIid,
  baseUrl
) {
  try {
    // Update progress
    updateJobProgress(jobId, 10, 'Fetching merge request details...');

    // Get MR details
    const mrData = await gitlabService.getMergeRequest(
      accessToken,
      projectPath,
      mrIid,
      baseUrl
    );

    updateJobProgress(jobId, 25, 'Fetching diffs and commits...');

    // Get diffs and commits in parallel
    const [diffsData, commitsData] = await Promise.all([
      gitlabService.getMergeRequestDiffs(
        accessToken,
        projectPath,
        mrIid,
        {},
        baseUrl
      ),
      gitlabService.getMergeRequestCommits(
        accessToken,
        projectPath,
        mrIid,
        baseUrl
      ),
    ]);

    updateJobProgress(jobId, 50, 'Analyzing code with AI...');

    // Generate AI review
    const reviewResult = await openaiService.generateCodeReview(
      mrData,
      diffsData || [],
      commitsData || []
    );

    updateJobProgress(jobId, 80, 'Posting review comments...');

    // Post review comments
    const postedComments = await postReviewComments(
      accessToken,
      projectPath,
      mrIid,
      reviewResult,
      mrData,
      baseUrl
    );

    updateJobProgress(jobId, 100, 'Review completed');

    // Mark job as completed
    reviewJobs.set(jobId, {
      ...reviewJobs.get(jobId),
      status: 'completed',
      result: {
        ...reviewResult,
        commentsPosted: postedComments.length,
        mrTitle: mrData.title,
        mrAuthor: mrData.author?.name,
      },
      endTime: new Date(),
    });

    logger.info('Review completed successfully', {
      jobId,
      projectPath,
      mrIid,
      commentsPosted: postedComments.length,
    });
  } catch (error) {
    let errorMessage = error.message;

    // Provide more specific error messages for common issues
    if (error.status === 401) {
      errorMessage = `GitLab authentication failed. Please check:
1. Your GitLab Personal Access Token is valid
2. Your token has 'api' scope permissions
3. Your token has access to ${baseUrl}
4. The project path '${projectPath}' exists and you have access`;
    } else if (error.status === 404) {
      errorMessage = `GitLab resource not found. Please check:
1. The merge request ${mrIid} exists in project '${projectPath}'
2. The project path is correct
3. Your token has access to this project`;
    } else if (error.status === 403) {
      errorMessage = `GitLab access forbidden. Your token may not have sufficient permissions for project '${projectPath}'`;
    }

    logger.error('Review processing failed with detailed info', {
      jobId,
      error: error.message,
      status: error.status,
      projectPath,
      mrIid,
      baseUrl,
      errorDetails: error.data || error.response?.data,
    });

    updateJobProgress(jobId, 0, `Error: ${errorMessage}`);
    throw error;
  }
}

/**
 * Update job progress
 * @param {string} jobId - Job ID
 * @param {number} progress - Progress percentage
 * @param {string} message - Status message
 */
function updateJobProgress(jobId, progress, message) {
  const job = reviewJobs.get(jobId);
  if (job) {
    reviewJobs.set(jobId, {
      ...job,
      progress,
      currentStep: message,
      lastUpdated: new Date(),
    });
  }
}

/**
 * Post review comments to GitLab
 * @param {string} accessToken - GitLab access token
 * @param {string} projectPath - Project path
 * @param {number} mrIid - MR IID
 * @param {Object} reviewResult - AI review result
 * @param {Object} mrData - MR data
 * @param {string} baseUrl - GitLab base URL
 * @returns {Promise<Array>} Posted comments
 */
async function postReviewComments(
  accessToken,
  projectPath,
  mrIid,
  reviewResult,
  mrData,
  baseUrl
) {
  const postedComments = [];

  try {
    // Post summary comment
    const summaryComment = openaiService.generateSummaryComment(
      reviewResult,
      mrData
    );
    const summaryResponse = await gitlabService.postMergeRequestNote(
      accessToken,
      projectPath,
      mrIid,
      summaryComment,
      baseUrl
    );
    postedComments.push(summaryResponse);

    // Post inline comments for each file issue
    for (const fileReview of reviewResult.fileReviews || []) {
      for (const issue of fileReview.issues || []) {
        if (issue.line && issue.severity !== 'low') {
          // Only post medium/high severity inline comments
          try {
            const inlineComment = formatInlineComment(
              issue,
              fileReview.filename
            );

            // Note: GitLab inline comments require specific position data
            // For simplicity, we'll post as regular notes with file reference
            const noteBody = `**${fileReview.filename}:${
              issue.line
            }** - ${issue.type.toUpperCase()}\n\n${inlineComment}`;

            const response = await gitlabService.postMergeRequestNote(
              accessToken,
              projectPath,
              mrIid,
              noteBody,
              baseUrl
            );
            postedComments.push(response);
          } catch (error) {
            logger.warn('Failed to post inline comment', {
              error: error.message,
              filename: fileReview.filename,
              line: issue.line,
            });
          }
        }
      }
    }
  } catch (error) {
    logger.error('Failed to post review comments', {
      error: error.message,
      projectPath,
      mrIid,
    });
    throw error;
  }

  return postedComments;
}

/**
 * Format inline comment
 * @param {Object} issue - Issue object
 * @param {string} filename - File name
 * @returns {string} Formatted comment
 */
function formatInlineComment(issue, filename) {
  const severityEmoji = {
    high: '🔴',
    medium: '🟡',
    low: '🟢',
  };

  const typeEmoji = {
    bug: '🐛',
    security: '🔒',
    performance: '⚡',
    style: '🎨',
    'best-practice': '💡',
    testing: '🧪',
  };

  let comment = `${severityEmoji[issue.severity]} ${
    typeEmoji[issue.type] || '📝'
  } **${issue.type.replace('-', ' ').toUpperCase()}**\n\n`;
  comment += `${issue.message}\n\n`;

  if (issue.suggestion) {
    comment += `💡 **Suggestion:**\n${issue.suggestion}\n\n`;
  }

  comment += `*Severity: ${issue.severity}*`;

  return comment;
}

/**
 * Get review analysis status
 */
const getReviewStatus = asyncHandler(async (req, res) => {
  logAPIRequest(req, 'Get Review Status');

  const { jobId } = req.params;
  const job = reviewJobs.get(jobId);

  if (!job) {
    throw new NotFoundError('Review job not found');
  }

  res.json({
    jobId,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
    startTime: job.startTime,
    lastUpdated: job.lastUpdated,
    endTime: job.endTime,
    ...(job.status === 'completed' && { result: job.result }),
    ...(job.status === 'failed' && { error: job.error }),
  });
});

/**
 * Get user's review history
 */
const getReviewHistory = asyncHandler(async (req, res) => {
  logAPIRequest(req, 'Get Review History');

  const { limit = 20, offset = 0 } = req.query;

  // Get all jobs (no user filtering)
  const allJobs = Array.from(reviewJobs.values())
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
    .slice(offset, offset + parseInt(limit));

  const history = allJobs.map((job) => ({
    jobId: job.id,
    status: job.status,
    startTime: job.startTime,
    endTime: job.endTime,
    mrUrl: job.mrUrl,
    projectPath: job.projectPath,
    mrIid: job.mrIid,
    ...(job.result && {
      summary: job.result.summary,
      commentsPosted: job.result.commentsPosted,
      overallRecommendation: job.result.overallRecommendation,
    }),
  }));

  res.json({
    history,
    total: allJobs.length,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });
});

/**
 * Provide feedback on a review
 */
const provideFeedback = asyncHandler(async (req, res) => {
  logAPIRequest(req, 'Provide Review Feedback');

  const { reviewId } = req.params;
  const { rating, feedback } = req.body;

  const job = reviewJobs.get(reviewId);
  if (!job) {
    throw new NotFoundError('Review not found');
  }

  // Store feedback (in production, save to database)
  const feedbackData = {
    reviewId,
    rating,
    feedback,
    timestamp: new Date(),
  };

  // Update job with feedback
  reviewJobs.set(reviewId, {
    ...job,
    feedback: feedbackData,
  });

  logger.info('Review feedback received', {
    reviewId,
    rating,
    hasFeedback: !!feedback,
  });

  res.json({
    message: 'Feedback received successfully',
    feedbackId: `feedback_${Date.now()}`,
  });
});

module.exports = {
  analyzeMergeRequest,
  getReviewStatus,
  getReviewHistory,
  provideFeedback,
};
