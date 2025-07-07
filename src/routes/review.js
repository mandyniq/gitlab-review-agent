const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { authenticateGitLabToken } = require('../middleware/auth');
const { validateMRUrl } = require('../middleware/validation');

/**
 * @route   POST /api/review/analyze
 * @desc    Analyze a GitLab Merge Request
 * @access  Private (requires PRIVATE-TOKEN header)
 */
router.post(
  '/analyze',
  authenticateGitLabToken,
  validateMRUrl,
  reviewController.analyzeMergeRequest
);

/**
 * @route   GET /api/review/status/:jobId
 * @desc    Get review analysis status
 * @access  Private (requires PRIVATE-TOKEN header)
 */
router.get(
  '/status/:jobId',
  authenticateGitLabToken,
  reviewController.getReviewStatus
);

/**
 * @route   GET /api/review/history
 * @desc    Get user's review history
 * @access  Private (requires PRIVATE-TOKEN header)
 */
router.get(
  '/history',
  authenticateGitLabToken,
  reviewController.getReviewHistory
);

/**
 * @route   POST /api/review/feedback/:reviewId
 * @desc    Provide feedback on a review
 * @access  Private (requires PRIVATE-TOKEN header)
 */
router.post(
  '/feedback/:reviewId',
  authenticateGitLabToken,
  reviewController.provideFeedback
);

module.exports = router;
