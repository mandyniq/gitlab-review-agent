const OpenAI = require('openai');
const { logger, logOpenAICall } = require('../utils/logger');
const {
  CODE_REVIEW_SYSTEM_PROMPT,
} = require('../prompts/codeReviewSystemPrompt');
const {
  OpenAIAPIError,
  RateLimitError,
} = require('../middleware/errorHandler');

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.model = process.env.OPENAI_MODEL || 'gpt-4';
    this.maxTokens = 2048;
    this.temperature = 0.1; // Low temperature for consistent, focused responses
  }

  /**
   * Generate code review for merge request changes
   * @param {Object} mrData - Merge request data
   * @param {Array} changes - Array of file changes
   * @param {Array} commits - Array of commit data
   * @returns {Promise<Object>} Review analysis
   */
  async generateCodeReview(mrData, changes, commits) {
    const startTime = Date.now();

    try {
      // Prepare the context for AI analysis
      const context = this.prepareMRContext(mrData, changes, commits);

      // Split large changes into chunks if necessary
      const reviewPromises = [];
      const chunks = this.chunkChanges(changes);

      for (const [index, chunk] of chunks.entries()) {
        const prompt = this.buildReviewPrompt(
          context,
          chunk,
          index,
          chunks.length
        );
        reviewPromises.push(this.callOpenAI(prompt, `chunk-${index}`));
      }

      const chunkReviews = await Promise.all(reviewPromises);

      // Combine and summarize reviews
      const combinedReview = await this.combineReviews(chunkReviews, context);

      const duration = Date.now() - startTime;
      const totalTokens = chunkReviews.reduce(
        (sum, review) => sum + (review.tokensUsed || 0),
        0
      );

      logOpenAICall(this.model, totalTokens, duration);

      return combinedReview;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('OpenAI code review generation failed', {
        error: error.message,
        duration,
        mrIid: mrData.iid,
        projectPath: mrData.project_id,
      });

      if (error.status === 429) {
        throw new RateLimitError('OpenAI API rate limit exceeded');
      }

      throw new OpenAIAPIError(
        'Failed to generate code review',
        error.status || 500
      );
    }
  }

  /**
   * Prepare merge request context for AI analysis
   * @param {Object} mrData - Merge request data
   * @param {Array} changes - File changes
   * @param {Array} commits - Commit data
   * @returns {Object} Context object
   */
  prepareMRContext(mrData, changes, commits) {
    return {
      title: mrData.title,
      description: mrData.description,
      sourceBranch: mrData.source_branch,
      targetBranch: mrData.target_branch,
      author: mrData.author?.name,
      changedFiles: changes.length,
      totalAdditions: changes.reduce(
        (sum, file) => sum + (file.additions || 0),
        0
      ),
      totalDeletions: changes.reduce(
        (sum, file) => sum + (file.deletions || 0),
        0
      ),
      commitCount: commits.length,
      recentCommitMessages: commits.slice(0, 5).map((commit) => commit.message),
    };
  }

  /**
   * Split large changes into manageable chunks
   * @param {Array} changes - File changes
   * @returns {Array} Array of change chunks
   */
  chunkChanges(changes) {
    const chunks = [];
    const maxFilesPerChunk = 10;
    const maxLinesPerChunk = 1000;

    let currentChunk = [];
    let currentLines = 0;

    for (const change of changes) {
      const fileLines = (change.additions || 0) + (change.deletions || 0);

      if (
        currentChunk.length >= maxFilesPerChunk ||
        currentLines + fileLines > maxLinesPerChunk
      ) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentLines = 0;
        }
      }

      currentChunk.push(change);
      currentLines += fileLines;
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Build review prompt for AI
   * @param {Object} context - MR context
   * @param {Array} changes - File changes chunk
   * @param {number} chunkIndex - Current chunk index
   * @param {number} totalChunks - Total number of chunks
   * @returns {string} Formatted prompt
   */
  buildReviewPrompt(context, changes, chunkIndex, totalChunks) {
    const contextInfo = `
Merge Request Context:
- Title: ${context.title}
- Description: ${context.description || 'No description'}
- Branch: ${context.sourceBranch} → ${context.targetBranch}
- Author: ${context.author}
- Files changed: ${context.changedFiles}
- Lines: +${context.totalAdditions} -${context.totalDeletions}
${
  totalChunks > 1 ? `- Reviewing chunk ${chunkIndex + 1} of ${totalChunks}` : ''
}

Recent commit messages:
${context.recentCommitMessages
  .slice(0, 3)
  .map((msg) => `- ${msg}`)
  .join('\n')}
`;

    const changesText = changes
      .map((change) => {
        const diff = change.diff || '';
        const filename = change.new_path || change.old_path;
        const fileInfo = `
--- File: ${filename} ---
${change.new_file ? '[NEW FILE]' : ''}${
          change.deleted_file ? '[DELETED FILE]' : ''
        }${change.renamed_file ? '[RENAMED FILE]' : ''}
${diff}
`;
        return fileInfo;
      })
      .join('\n');

    return `${CODE_REVIEW_SYSTEM_PROMPT}\n\n${contextInfo}\n\nChanges to review:\n${changesText}`;
  }

  /**
   * Call OpenAI API with retry logic
   * @param {string} prompt - The prompt to send
   * @param {string} identifier - Identifier for logging
   * @returns {Promise<Object>} AI response
   */
  async callOpenAI(prompt, identifier) {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content);

      return {
        ...result,
        tokensUsed: response.usage?.total_tokens || 0,
        identifier,
      };
    } catch (error) {
      logger.error('OpenAI API call failed', {
        identifier,
        error: error.message,
        model: this.model,
      });
      throw error;
    }
  }

  /**
   * Combine multiple chunk reviews into a single comprehensive review
   * @param {Array} chunkReviews - Array of chunk review results
   * @param {Object} context - MR context
   * @returns {Promise<Object>} Combined review
   */
  async combineReviews(chunkReviews, context) {
    if (chunkReviews.length === 1) {
      return chunkReviews[0];
    }

    // If multiple chunks, create a summary
    const allFileReviews = chunkReviews.flatMap(
      (review) => review.fileReviews || []
    );
    const allIssues = allFileReviews.flatMap((file) => file.issues || []);

    // Count issues by severity
    const issueCounts = {
      high: allIssues.filter((issue) => issue.severity === 'high').length,
      medium: allIssues.filter((issue) => issue.severity === 'medium').length,
      low: allIssues.filter((issue) => issue.severity === 'low').length,
    };

    // Determine overall recommendation
    let overallRecommendation = 'approve';
    if (issueCounts.high > 0) {
      overallRecommendation = 'request-changes';
    } else if (issueCounts.medium > 2 || issueCounts.low > 5) {
      overallRecommendation = 'comment';
    }

    const combinedSummary =
      `Reviewed ${allFileReviews.length} files with ${allIssues.length} total issues found: ` +
      `${issueCounts.high} high, ${issueCounts.medium} medium, ${issueCounts.low} low severity issues.`;

    // Combine key insights from all chunks
    const allKeyInsights = chunkReviews.flatMap(
      (review) => review.keyInsights || []
    );

    return {
      summary: combinedSummary,
      fileReviews: allFileReviews,
      overallRecommendation,
      keyInsights: allKeyInsights,
      issueCounts,
      totalTokensUsed: chunkReviews.reduce(
        (sum, review) => sum + (review.tokensUsed || 0),
        0
      ),
    };
  }

  /**
   * Generate a summary comment for the merge request
   * @param {Object} reviewResult - Combined review result
   * @param {Object} context - MR context
   * @returns {string} Formatted summary comment
   */
  generateSummaryComment(reviewResult, context) {
    const { summary, issueCounts, overallRecommendation, keyInsights } =
      reviewResult;

    const emoji = {
      approve: '✅',
      comment: '💬',
      'request-changes': '❌',
    };

    let comment = `## 🤖 AI Code Review Summary ${emoji[overallRecommendation]}\n\n`;
    comment += `${summary}\n\n`;

    if (issueCounts) {
      comment += `### 📊 Issues Found:\n`;
      comment += `- 🔴 **High severity**: ${issueCounts.high}\n`;
      comment += `- 🟡 **Medium severity**: ${issueCounts.medium}\n`;
      comment += `- 🟢 **Low severity**: ${issueCounts.low}\n\n`;
    }

    // Add key insights if available
    if (keyInsights && keyInsights.length > 0) {
      comment += `### 💡 Key Insights:\n`;
      keyInsights.forEach((insight) => {
        comment += `- ${insight}\n`;
      });
      comment += `\n`;
    }

    if (overallRecommendation === 'approve') {
      comment += `### ✅ Recommendation: Approve\nThe code changes look good to merge! 🚀\n\n`;
    } else if (overallRecommendation === 'request-changes') {
      comment += `### ❌ Recommendation: Request Changes\nPlease address the high-severity issues before merging. 🔧\n\n`;
    } else {
      comment += `### 💬 Recommendation: Comment\nConsider addressing the identified issues to improve code quality. 📈\n\n`;
    }

    comment += `---\n*🤖 This review was generated by AI. Please verify the suggestions and use your judgment.*`;

    return comment;
  }
}

// Export singleton instance
const openaiService = new OpenAIService();

module.exports = {
  openaiService,
  OpenAIService,
};
