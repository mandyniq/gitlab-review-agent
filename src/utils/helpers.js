const cron = require('node-cron');
const { logger } = require('./logger');

/**
 * Utility functions for the GitLab Code Review Agent
 */

/**
 * Parse GitLab MR URL and extract components
 * @param {string} mrUrl - GitLab MR URL
 * @returns {Object|null} Parsed components or null if invalid
 */
function parseGitLabMRUrl(mrUrl) {
  const pattern =
    /^(https?:\/\/[^\/]+)\/([^\/]+\/[^\/]+)\/-\/merge_requests\/(\d+)$/;
  const match = mrUrl.match(pattern);

  if (!match) {
    return null;
  }

  return {
    baseUrl: match[1],
    projectPath: match[2],
    mrIid: parseInt(match[3], 10),
    fullUrl: mrUrl,
  };
}

/**
 * Validate file extension for code review
 * @param {string} filename - File name
 * @returns {boolean} Whether file should be reviewed
 */
function shouldReviewFile(filename) {
  // Common code file extensions
  const codeExtensions = [
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.py',
    '.rb',
    '.php',
    '.java',
    '.c',
    '.cpp',
    '.h',
    '.hpp',
    '.cs',
    '.go',
    '.rs',
    '.swift',
    '.kt',
    '.scala',
    '.clj',
    '.hs',
    '.sql',
    '.sh',
    '.bash',
    '.ps1',
    '.html',
    '.css',
    '.scss',
    '.less',
    '.vue',
    '.svelte',
    '.elm',
    '.yaml',
    '.yml',
    '.json',
    '.xml',
    '.dockerfile',
    '.tf',
    '.hcl',
  ];

  // Files to ignore
  const ignorePatterns = [
    /node_modules/,
    /\.git/,
    /build/,
    /dist/,
    /coverage/,
    /\.min\./,
    /package-lock\.json/,
    /yarn\.lock/,
    /Pipfile\.lock/,
    /\.pyc$/,
    /\.class$/,
    /\.o$/,
    /\.so$/,
    /\.dll$/,
  ];

  // Check if file should be ignored
  if (ignorePatterns.some((pattern) => pattern.test(filename))) {
    return false;
  }

  // Check if file has reviewable extension
  const ext = '.' + filename.split('.').pop().toLowerCase();
  return codeExtensions.includes(ext);
}

/**
 * Extract programming language from filename
 * @param {string} filename - File name
 * @returns {string} Programming language
 */
function detectLanguage(filename) {
  const ext = '.' + filename.split('.').pop().toLowerCase();

  const languageMap = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.rb': 'ruby',
    '.php': 'php',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.clj': 'clojure',
    '.hs': 'haskell',
    '.sql': 'sql',
    '.sh': 'bash',
    '.bash': 'bash',
    '.ps1': 'powershell',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.vue': 'vue',
    '.svelte': 'svelte',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.json': 'json',
    '.xml': 'xml',
    '.dockerfile': 'dockerfile',
    '.tf': 'terraform',
  };

  return languageMap[ext] || 'text';
}

/**
 * Calculate diff statistics
 * @param {string} diff - Git diff content
 * @returns {Object} Diff statistics
 */
function calculateDiffStats(diff) {
  if (!diff) {
    return { additions: 0, deletions: 0, total: 0 };
  }

  const lines = diff.split('\n');
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      additions++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions++;
    }
  }

  return {
    additions,
    deletions,
    total: additions + deletions,
  };
}

/**
 * Format duration in human readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Sanitize text for safe display
 * @param {string} text - Input text
 * @returns {string} Sanitized text
 */
function sanitizeText(text) {
  if (!text) return '';

  // Remove or escape potentially dangerous characters
  return text
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Chunk array into smaller arrays
 * @param {Array} array - Input array
 * @param {number} chunkSize - Size of each chunk
 * @returns {Array} Array of chunks
 */
function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Cleanup old review jobs
 * @param {Map} reviewJobs - Review jobs map
 * @param {number} retentionDays - Number of days to retain jobs
 */
function cleanupOldJobs(reviewJobs, retentionDays = 7) {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  let cleanedCount = 0;

  for (const [jobId, job] of reviewJobs.entries()) {
    if (job.startTime < cutoffDate) {
      reviewJobs.delete(jobId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.info(`Cleaned up ${cleanedCount} old review jobs`);
  }

  return cleanedCount;
}

/**
 * Start periodic cleanup job
 * @param {Map} reviewJobs - Review jobs map
 * @param {number} retentionDays - Number of days to retain jobs
 */
function startPeriodicCleanup(reviewJobs, retentionDays = 7) {
  // Run cleanup every hour
  cron.schedule('0 * * * *', () => {
    try {
      cleanupOldJobs(reviewJobs, retentionDays);
    } catch (error) {
      logger.error('Job cleanup failed', { error: error.message });
    }
  });

  logger.info('Periodic job cleanup scheduled (every hour)');
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxAttempts - Maximum number of attempts
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Function result
 */
async function retryWithBackoff(fn, maxAttempts = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        break;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
        error: error.message,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

module.exports = {
  parseGitLabMRUrl,
  shouldReviewFile,
  detectLanguage,
  calculateDiffStats,
  formatDuration,
  sanitizeText,
  chunkArray,
  cleanupOldJobs,
  startPeriodicCleanup,
  retryWithBackoff,
};
