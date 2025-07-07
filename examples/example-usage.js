#!/usr/bin/env node

/**
 * Example script demonstrating how to use the GitLab Code Review Agent API
 *
 * Usage:
 * GITLAB_TOKEN=your_token node examples/example-usage.js
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

class GitLabReviewClient {
  constructor(baseUrl = API_BASE_URL, gitlabToken = null) {
    this.baseUrl = baseUrl;
    this.gitlabToken = gitlabToken;
  }

  /**
   * Set GitLab token for authentication
   */
  setGitLabToken(token) {
    this.gitlabToken = token;
  }

  /**
   * Get authenticated request headers
   */
  getHeaders() {
    if (!this.gitlabToken) {
      throw new Error('GitLab token not set. Use setGitLabToken() first.');
    }
    return {
      'PRIVATE-TOKEN': this.gitlabToken,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Validate GitLab token
   */
  async validateToken() {
    try {
      console.log('🔑 Validating GitLab token...');

      const response = await axios.get(`${this.baseUrl}/auth/validate`, {
        headers: this.getHeaders(),
      });

      if (response.data.valid) {
        console.log('✅ GitLab token is valid');
        console.log(
          `👤 User: ${response.data.user.name} (@${response.data.user.username})`
        );
        return response.data;
      } else {
        throw new Error('Token validation failed');
      }
    } catch (error) {
      console.error(
        '❌ Failed to validate token:',
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Analyze a merge request
   */
  async analyzeMergeRequest(mrUrl) {
    try {
      console.log(`🔍 Starting analysis of: ${mrUrl}`);

      const response = await axios.post(
        `${this.baseUrl}/review/analyze`,
        { mrUrl },
        {
          headers: this.getHeaders(),
        }
      );

      console.log(`📝 Analysis started with job ID: ${response.data.jobId}`);
      return response.data.jobId;
    } catch (error) {
      console.error(
        '❌ Failed to start analysis:',
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Check analysis status
   */
  async checkStatus(jobId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/review/status/${jobId}`,
        {
          headers: this.getHeaders(),
        }
      );

      const { status, progress, currentStep, result } = response.data;

      console.log(`📊 Status: ${status} (${progress}%)`);
      if (currentStep) {
        console.log(`🔄 Current step: ${currentStep}`);
      }

      if (status === 'completed' && result) {
        console.log('✅ Analysis completed!');
        console.log(`📈 Summary: ${result.summary}`);
        console.log(`💬 Comments posted: ${result.commentsPosted}`);
        console.log(`🎯 Recommendation: ${result.overallRecommendation}`);
      } else if (status === 'failed') {
        console.log('❌ Analysis failed');
      }

      return response.data;
    } catch (error) {
      console.error(
        '❌ Failed to check status:',
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Get review history
   */
  async getHistory() {
    try {
      const response = await axios.get(`${this.baseUrl}/review/history`, {
        headers: this.getHeaders(),
      });

      console.log(
        `📚 Found ${response.data.history.length} reviews in history:`
      );

      response.data.history.forEach((review, index) => {
        console.log(`\n${index + 1}. ${review.projectPath}!${review.mrIid}`);
        console.log(`   Status: ${review.status}`);
        console.log(
          `   Started: ${new Date(review.startTime).toLocaleString()}`
        );
        if (review.summary) {
          console.log(`   Summary: ${review.summary.substring(0, 100)}...`);
        }
      });

      return response.data;
    } catch (error) {
      console.error(
        '❌ Failed to get history:',
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * Helper: Wait for analysis to complete
   */
  async waitForCompletion(jobId, maxWaitTime = 300000) {
    // 5 minutes
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    console.log('⏳ Waiting for analysis to complete...');

    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.checkStatus(jobId);

      if (status.status === 'completed') {
        console.log('🎉 Analysis completed successfully!');
        return status;
      } else if (status.status === 'failed') {
        throw new Error(`Analysis failed: ${status.error}`);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error('Analysis timed out');
  }
}

// Example usage
async function main() {
  // Get GitLab token from environment variable
  const gitlabToken = process.env.GITLAB_TOKEN;

  if (!gitlabToken) {
    console.error('❌ Error: GITLAB_TOKEN environment variable is required');
    console.log('\n📖 Usage:');
    console.log('GITLAB_TOKEN=your_token node examples/example-usage.js');
    process.exit(1);
  }

  const client = new GitLabReviewClient();
  client.setGitLabToken(gitlabToken);

  try {
    console.log('🚀 GitLab Code Review Agent - Example Usage\n');

    // Step 1: Validate the GitLab token
    await client.validateToken();

    // Step 2: Example MR URL (you should replace this with an actual MR)
    const exampleMrUrl =
      'https://gitlab.td.gfk.com/group/project/-/merge_requests/123';
    console.log(`\n🔍 Example: Would analyze MR: ${exampleMrUrl}`);

    // To analyze a real MR, uncomment and modify the following:
    // const jobId = await client.analyzeMergeRequest(exampleMrUrl);
    // await client.waitForCompletion(jobId);
    // await client.getHistory();

    console.log('\n✅ Example completed successfully!');
    console.log(
      '\n💡 To analyze a real MR, update the exampleMrUrl and enable the analysis code.'
    );
  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = GitLabReviewClient;
