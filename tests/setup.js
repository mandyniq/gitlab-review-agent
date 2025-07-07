// Test setup file
require('dotenv').config({ path: '.env.test' });

// Mock external services in tests
jest.mock('../src/services/gitlabService', () => ({
  gitlabService: {
    makeAPICall: jest.fn(),
    getMergeRequest: jest.fn(),
    getMergeRequestDiffs: jest.fn(),
    getMergeRequestCommits: jest.fn(),
    postMergeRequestNote: jest.fn(),
    postMergeRequestDiscussion: jest.fn(),
  },
}));

jest.mock('../src/services/openaiService', () => ({
  openaiService: {
    generateCodeReview: jest.fn(),
    generateSummaryComment: jest.fn(),
  },
}));

// Global test timeout
jest.setTimeout(10000);
