# GitLab Code Review Agent

An intelligent AI-powered agent that automates code reviews for GitLab Merge Requests using OpenAI's GPT models. This tool enhances development workflows by providing quick, consistent, and insightful feedback on code quality, style, security, and logic.

## 🚀 Features

- **Direct GitLab Token Authentication**: Simple and secure authentication using Personal Access Tokens
- **AI-Powered Reviews**: Uses OpenAI GPT-4 for intelligent code analysis
- **Comprehensive Analysis**: Reviews code for:
  - Correctness and potential bugs
  - Security vulnerabilities
  - Performance issues
  - Code style and maintainability
  - Best practices
- **Automated Comments**: Posts inline comments and summary reviews
- **Async Processing**: Handles large merge requests efficiently
- **Rate Limiting**: Respects API limits for both GitLab and OpenAI
- **Comprehensive Logging**: Full audit trail for debugging and monitoring

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │────│  Express API    │────│   GitLab API    │
│  (Optional)     │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                       ┌─────────────────┐
                       │   OpenAI API    │
                       │                 │
                       └─────────────────┘
```

## 📋 Prerequisites

- Node.js 22.0 or higher
- GitLab account with appropriate permissions
- OpenAI API key
- Git repository access

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd gitlab-code-review-agent
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create environment configuration**

   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**
   Edit `.env` file with your credentials:

   ```env
   # GitLab Configuration (optional - for server-side default)
   GITLAB_TOKEN=your_gitlab_personal_access_token_optional
   GITLAB_BASE_URL=https://gitlab.td.gfk.com

   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4o

   # Application Configuration
   NODE_ENV=development
   PORT=3000
   ```

## 🔧 GitLab Personal Access Token Setup

1. Go to your GitLab instance → User Settings → Access Tokens
2. Create a new token with:
   - **Name**: GitLab Code Review Agent
   - **Scopes**: `read_api`, `read_repository`, `write_repository`
   - **Expiration**: Set as needed (optional)
3. Use this token in the `PRIVATE-TOKEN` header when making API requests

## 🚀 Usage

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### API Endpoints

#### Code Review

- `POST /api/review/analyze` - Analyze a merge request (requires PRIVATE-TOKEN header)
- `GET /api/review/status/:jobId` - Get review status (requires PRIVATE-TOKEN header)
- `GET /api/review/history` - Get review history (requires PRIVATE-TOKEN header)
- `POST /api/review/feedback/:reviewId` - Provide feedback (requires PRIVATE-TOKEN header)

### GitLab API Compatibility

This application uses GitLab API v4 and is compatible with the latest GitLab versions. Key endpoints used:

- **Merge Request Details**: `GET /projects/:id/merge_requests/:merge_request_iid`
- **Merge Request Diffs**: `GET /projects/:id/merge_requests/:merge_request_iid/diffs` (recommended)
- **Merge Request Changes**: `GET /projects/:id/merge_requests/:merge_request_iid/changes` (deprecated, but still supported for backward compatibility)
- **Merge Request Commits**: `GET /projects/:id/merge_requests/:merge_request_iid/commits`
- **Merge Request Notes**: `POST /projects/:id/merge_requests/:merge_request_iid/notes`

The application automatically handles:

- Rate limiting with exponential backoff
- API error handling and retries
- Authentication via GitLab Personal Access Tokens (PRIVATE-TOKEN header)
- Future API v5 compatibility (avoiding deprecated fields)

### Example Usage

1. **Analyze a Merge Request**

   ```bash
   curl -X POST "http://localhost:3000/api/review/analyze" \
     -H "PRIVATE-TOKEN: YOUR_GITLAB_PERSONAL_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "mrUrl": "https://gitlab.td.gfk.com/group/project/-/merge_requests/123"
     }'
   ```

2. **Check Review Status**

   ```bash
   curl -X GET "http://localhost:3000/api/review/status/review_12345" \
     -H "PRIVATE-TOKEN: YOUR_GITLAB_PERSONAL_ACCESS_TOKEN"
   ```

## 🎯 AI Review Capabilities

The AI reviewer acts as an expert senior software engineer with 10+ years of experience, providing comprehensive analysis across multiple dimensions:

### 🔍 Review Focus Areas

- **🔒 Security**: SQL injection, XSS, CSRF, authentication flaws, sensitive data exposure
- **🐛 Correctness**: Logic errors, edge cases, race conditions, error handling
- **⚡ Performance**: Algorithm efficiency, database queries, memory management, caching
- **🏗️ Code Quality**: DRY violations, SOLID principles, maintainability, documentation
- **💡 Best Practices**: Language idioms, framework conventions, design patterns
- **🧪 Testing**: Coverage gaps, test quality, edge case testing

### 📊 Severity Levels

- **🔴 HIGH**: Security vulnerabilities, critical bugs, performance killers
- **🟡 MEDIUM**: Logic errors, maintainability issues, moderate performance problems
- **🟢 LOW**: Style issues, minor optimizations, documentation improvements

### 💬 Review Output

The AI provides structured feedback including:

- **Summary**: Overall assessment with issue counts
- **File-by-file analysis**: Specific issues with line numbers and suggestions
- **Key insights**: Important observations about the overall change
- **Recommendation**: Approve, request changes, or comment
- **Positive recognition**: Acknowledgment of good practices and improvements

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 🔍 Logging

The application uses Winston for comprehensive logging:

- Error logs: `logs/error.log`
- Combined logs: `logs/combined.log`
- Console output in development mode

Log levels: `error`, `warn`, `info`, `debug`

## 📊 Monitoring

The application includes:

- Health check endpoint: `GET /health`
- Request logging with Morgan
- Error tracking and reporting
- API call metrics for GitLab and OpenAI

## 🔒 Security Features

- Direct GitLab token authentication
- Rate limiting (100 requests per 15 minutes per IP)
- Helmet.js security headers
- CORS configuration
- Input validation and sanitization
- Secure token handling

## 🎛️ Configuration

Key configuration options in `src/config/index.js`:

- **Rate Limiting**: Customize request limits
- **Review Processing**: Adjust chunk sizes and concurrent jobs
- **API Timeouts**: Configure timeout values
- **Logging**: Set log levels and retention

## 🚀 Deployment

### Docker (Optional)

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
# ... other production settings
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📋 TODO / Roadmap

- [ ] Web UI for easier interaction
- [ ] Database integration for persistent storage
- [ ] Webhook support for automatic reviews
- [ ] Custom review rules and templates
- [ ] Integration with more AI providers
- [ ] Metrics dashboard
- [ ] Team management features

## 🐛 Troubleshooting

### Common Issues

1. **GitLab OAuth fails**

   - Check CLIENT_ID and CLIENT_SECRET
   - Verify redirect URI matches exactly
   - Ensure required scopes are granted

2. **OpenAI API errors**

   - Verify API key is valid
   - Check rate limits and usage quotas
   - Ensure model is available

3. **Review comments not posted**
   - Verify `write_repository` scope is granted
   - Check GitLab permissions for the project
   - Review error logs for API failures

### Debug Mode

Set `LOG_LEVEL=debug` in your environment for verbose logging.

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for GPT API
- GitLab for comprehensive API
- Express.js community
- All contributors and testers

## 📞 Support

For issues and questions:

1. Check the troubleshooting section
2. Search existing issues
3. Create a new issue with detailed information
4. Include logs and configuration (without secrets)

---

**Note**: This tool is designed to assist in code reviews, not replace human judgment. Always verify AI suggestions and use your professional discretion.
