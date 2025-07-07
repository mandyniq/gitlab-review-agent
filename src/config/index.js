module.exports = {
  // Application Configuration
  app: {
    name: 'GitLab Code Review Agent',
    version: '1.0.0',
    port: parseInt(process.env.PORT) || 3000,
    env: process.env.NODE_ENV || 'development',
  },

  // GitLab Configuration
  gitlab: {
    token: process.env.GITLAB_TOKEN,
    baseUrl: process.env.GITLAB_BASE_URL || 'https://gitlab.td.gfk.com',
  },

  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 2048,
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxSize: '5m',
    maxFiles: 5,
    datePattern: 'YYYY-MM-DD',
  },

  // CORS Configuration
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200,
  },

  // Review Processing Configuration
  review: {
    maxFilesPerChunk: parseInt(process.env.MAX_FILES_PER_CHUNK) || 10,
    maxLinesPerChunk: parseInt(process.env.MAX_LINES_PER_CHUNK) || 1000,
    jobRetentionDays: parseInt(process.env.JOB_RETENTION_DAYS) || 7,
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS) || 5,
  },

  // API Configuration
  api: {
    timeout: parseInt(process.env.API_TIMEOUT) || 30000, // 30 seconds
    retryAttempts: parseInt(process.env.API_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(process.env.API_RETRY_DELAY) || 1000, // 1 second
  },
};

// Validation
const config = module.exports;

// Validate required environment variables
const requiredEnvVars = ['OPENAI_API_KEY'];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:');
  missingEnvVars.forEach((envVar) => console.error(`- ${envVar}`));
  console.error('Please check your .env file or environment configuration.');

  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}
