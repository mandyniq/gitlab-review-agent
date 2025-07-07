const axios = require('axios');
const { logger, logGitLabAPICall } = require('../utils/logger');
const {
  GitLabAPIError,
  RateLimitError,
} = require('../middleware/errorHandler');

class GitLabService {
  constructor() {
    this.baseURL = process.env.GITLAB_BASE_URL || 'https://gitlab.td.gfk.com';
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Make authenticated API call to GitLab
   * @param {string} accessToken - GitLab access token
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} url - API endpoint URL
   * @param {Object} data - Request data (for POST requests)
   * @param {string} baseUrl - Custom GitLab base URL (optional)
   * @returns {Promise} API response
   */
  async makeAPICall(accessToken, method, url, data = null, baseUrl = null) {
    const gitlabBaseUrl = baseUrl || this.baseURL;
    const config = {
      method,
      url: `${gitlabBaseUrl}/api/v4${url}`,
      headers: {
        'PRIVATE-TOKEN': accessToken,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    };

    if (data) {
      config.data = data;
    }

    return await this.executeWithRetry(() => axios(config), `${method} ${url}`);
  }

  /**
   * Handle API errors and retry logic
   * @param {Function} apiCall - API call function
   * @param {string} operation - Description of operation for logging
   * @returns {Promise} API response
   */
  async executeWithRetry(apiCall, operation) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const startTime = Date.now();
        const response = await apiCall();
        const duration = Date.now() - startTime;

        logGitLabAPICall(operation, 'GET', response.status, duration);
        return response.data;
      } catch (error) {
        const duration = Date.now() - (Date.now() - this.retryDelay);

        if (error.response) {
          const { status, data } = error.response;
          logGitLabAPICall(operation, 'GET', status, duration);

          if (status === 429) {
            // Rate limit hit
            const retryAfter =
              error.response.headers['retry-after'] || this.retryDelay;
            logger.warn(`Rate limit hit, retrying after ${retryAfter}ms`, {
              operation,
              attempt,
              status,
            });

            if (attempt === this.retryAttempts) {
              throw new RateLimitError('GitLab API rate limit exceeded');
            }

            await this.delay(retryAfter * 1000);
            continue;
          }

          if (status >= 500 && attempt < this.retryAttempts) {
            // Server error, retry
            logger.warn(`Server error, retrying`, {
              operation,
              attempt,
              status,
              error: data,
            });
            await this.delay(this.retryDelay * attempt);
            continue;
          }

          throw new GitLabAPIError(
            data.message || `GitLab API error: ${status}`,
            status,
            data
          );
        }

        logger.error('GitLab API call failed', {
          operation,
          error: error.message,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers
              ? { ...error.config.headers, 'PRIVATE-TOKEN': '[REDACTED]' }
              : undefined,
          },
        });

        if (attempt === this.retryAttempts) {
          logger.error('GitLab API call failed after all retries', {
            operation,
            error: error.message,
          });
          throw new GitLabAPIError(
            'GitLab API call failed',
            500,
            error.message
          );
        }

        await this.delay(this.retryDelay * attempt);
      }
    }
  }

  /**
   * Delay function for retries
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get merge request details
   * @param {string} accessToken - GitLab access token
   * @param {string} projectPath - Project path (e.g., 'group/project')
   * @param {number} mrIid - Merge request IID
   * @param {string} baseUrl - Custom GitLab base URL (optional)
   * @returns {Promise<Object>} Merge request data
   */
  async getMergeRequest(accessToken, projectPath, mrIid, baseUrl = null) {
    return await this.makeAPICall(
      accessToken,
      'GET',
      `/projects/${encodeURIComponent(projectPath)}/merge_requests/${mrIid}`,
      null,
      baseUrl
    );
  }

  /**
   * Get merge request diffs
   * @param {string} accessToken - GitLab access token
   * @param {string} projectPath - Project path
   * @param {number} mrIid - Merge request IID
   * @param {Object} options - Optional parameters (page, per_page, unidiff)
   * @param {string} baseUrl - Custom GitLab base URL (optional)
   * @returns {Promise<Array>} Diffs data
   */
  async getMergeRequestDiffs(
    accessToken,
    projectPath,
    mrIid,
    options = {},
    baseUrl = null
  ) {
    const params = new URLSearchParams();

    // Add optional parameters
    if (options.page) params.append('page', options.page);
    if (options.per_page) params.append('per_page', options.per_page);
    if (options.unidiff) params.append('unidiff', options.unidiff);

    const queryString = params.toString();
    const urlPath = `/projects/${encodeURIComponent(
      projectPath
    )}/merge_requests/${mrIid}/diffs`;
    const url = queryString ? `${urlPath}?${queryString}` : urlPath;

    return await this.makeAPICall(accessToken, 'GET', url, null, baseUrl);
  }

  /**
   * Get merge request commits
   * @param {string} accessToken - GitLab access token
   * @param {string} projectPath - Project path
   * @param {number} mrIid - Merge request IID
   * @param {string} baseUrl - Custom GitLab base URL (optional)
   * @returns {Promise<Array>} Commits data
   */
  async getMergeRequestCommits(
    accessToken,
    projectPath,
    mrIid,
    baseUrl = null
  ) {
    return await this.makeAPICall(
      accessToken,
      'GET',
      `/projects/${encodeURIComponent(
        projectPath
      )}/merge_requests/${mrIid}/commits`,
      null,
      baseUrl
    );
  }

  /**
   * Post a note (comment) on merge request
   * @param {string} accessToken - GitLab access token
   * @param {string} projectPath - Project path
   * @param {number} mrIid - Merge request IID
   * @param {string} body - Comment body
   * @param {string} baseUrl - Custom GitLab base URL (optional)
   * @returns {Promise<Object>} Created note data
   */
  async postMergeRequestNote(
    accessToken,
    projectPath,
    mrIid,
    body,
    baseUrl = null
  ) {
    return await this.makeAPICall(
      accessToken,
      'POST',
      `/projects/${encodeURIComponent(
        projectPath
      )}/merge_requests/${mrIid}/notes`,
      { body },
      baseUrl
    );
  }

  /**
   * Post a discussion (inline comment) on merge request
   * @param {string} accessToken - GitLab access token
   * @param {string} projectPath - Project path
   * @param {number} mrIid - Merge request IID
   * @param {Object} discussionData - Discussion data including position
   * @returns {Promise<Object>} Created discussion data
   */
  async postMergeRequestDiscussion(
    accessToken,
    projectPath,
    mrIid,
    discussionData
  ) {
    return await this.makeAPICall(
      accessToken,
      'POST',
      `/projects/${encodeURIComponent(
        projectPath
      )}/merge_requests/${mrIid}/discussions`,
      discussionData
    );
  }

  /**
   * Get project information
   * @param {string} accessToken - GitLab access token
   * @param {string} projectPath - Project path
   * @returns {Promise<Object>} Project data
   */
  async getProject(accessToken, projectPath) {
    return await this.makeAPICall(
      accessToken,
      'GET',
      `/projects/${encodeURIComponent(projectPath)}`
    );
  }

  /**
   * Get merge request participants
   * @param {string} accessToken - GitLab access token
   * @param {string} projectPath - Project path
   * @param {number} mrIid - Merge request IID
   * @returns {Promise<Array>} Participants data
   */
  async getMergeRequestParticipants(accessToken, projectPath, mrIid) {
    return await this.makeAPICall(
      accessToken,
      'GET',
      `/projects/${encodeURIComponent(
        projectPath
      )}/merge_requests/${mrIid}/participants`
    );
  }

  /**
   * Get merge request reviewers
   * @param {string} accessToken - GitLab access token
   * @param {string} projectPath - Project path
   * @param {number} mrIid - Merge request IID
   * @returns {Promise<Array>} Reviewers data
   */
  async getMergeRequestReviewers(accessToken, projectPath, mrIid) {
    return await this.makeAPICall(
      accessToken,
      'GET',
      `/projects/${encodeURIComponent(
        projectPath
      )}/merge_requests/${mrIid}/reviewers`
    );
  }
}

// Export singleton instance
const gitlabService = new GitLabService();

module.exports = {
  gitlabService,
  GitLabService,
};
