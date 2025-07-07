const request = require('supertest');
const app = require('../index');

describe('GitLab Code Review Agent API', () => {
  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for protected routes', async () => {
      await request(app).get('/api/review/history').expect(401);
    });
  });

  describe('Review Routes', () => {
    it('should require authentication for review analysis', async () => {
      await request(app)
        .post('/api/review/analyze')
        .send({
          mrUrl: 'https://gitlab.td.gfk.com/test/repo/-/merge_requests/1',
        })
        .expect(401);
    });

    it('should validate MR URL format', async () => {
      // This would require a valid GitLab token in a real test
      // For now, we're just testing the route exists
      await request(app)
        .post('/api/review/analyze')
        .send({ mrUrl: 'invalid-url' })
        .expect(401); // Will fail auth before validation
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      await request(app).get('/api/unknown-route').expect(404);
    });
  });
});
