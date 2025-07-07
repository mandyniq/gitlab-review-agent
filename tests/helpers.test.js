const {
  parseGitLabMRUrl,
  shouldReviewFile,
  detectLanguage,
  calculateDiffStats,
  formatDuration,
  sanitizeText,
  chunkArray,
} = require('../src/utils/helpers');

describe('Utility Functions', () => {
  describe('parseGitLabMRUrl', () => {
    it('should parse valid GitLab MR URLs', () => {
      const url =
        'https://gitlab.td.gfk.com/group/project/-/merge_requests/123';
      const result = parseGitLabMRUrl(url);

      expect(result).toEqual({
        baseUrl: 'https://gitlab.td.gfk.com',
        projectPath: 'group/project',
        mrIid: 123,
        fullUrl: url,
      });
    });

    it('should parse custom GitLab instance URLs', () => {
      const url = 'https://gitlab.example.com/team/repo/-/merge_requests/456';
      const result = parseGitLabMRUrl(url);

      expect(result).toEqual({
        baseUrl: 'https://gitlab.example.com',
        projectPath: 'team/repo',
        mrIid: 456,
        fullUrl: url,
      });
    });

    it('should return null for invalid URLs', () => {
      expect(parseGitLabMRUrl('invalid-url')).toBeNull();
      expect(
        parseGitLabMRUrl('https://github.com/user/repo/pull/1')
      ).toBeNull();
      expect(
        parseGitLabMRUrl('https://gitlab.td.gfk.com/project/-/issues/1')
      ).toBeNull();
    });
  });

  describe('shouldReviewFile', () => {
    it('should return true for code files', () => {
      expect(shouldReviewFile('src/index.js')).toBe(true);
      expect(shouldReviewFile('components/App.tsx')).toBe(true);
      expect(shouldReviewFile('main.py')).toBe(true);
      expect(shouldReviewFile('app.rb')).toBe(true);
    });

    it('should return false for non-code files', () => {
      expect(shouldReviewFile('README.md')).toBe(false);
      expect(shouldReviewFile('image.png')).toBe(false);
      expect(shouldReviewFile('package-lock.json')).toBe(false);
      expect(shouldReviewFile('node_modules/lib.js')).toBe(false);
    });
  });

  describe('detectLanguage', () => {
    it('should detect programming languages correctly', () => {
      expect(detectLanguage('app.js')).toBe('javascript');
      expect(detectLanguage('component.tsx')).toBe('typescript');
      expect(detectLanguage('script.py')).toBe('python');
      expect(detectLanguage('server.rb')).toBe('ruby');
      expect(detectLanguage('Main.java')).toBe('java');
      expect(detectLanguage('main.go')).toBe('go');
    });

    it('should return text for unknown extensions', () => {
      expect(detectLanguage('unknown.xyz')).toBe('text');
    });
  });

  describe('calculateDiffStats', () => {
    it('should calculate diff statistics correctly', () => {
      const diff = `--- a/file.js
+++ b/file.js
@@ -1,3 +1,4 @@
 function test() {
-  console.log('old');
+  console.log('new');
+  console.log('added');
 }`;

      const stats = calculateDiffStats(diff);
      expect(stats.additions).toBe(2);
      expect(stats.deletions).toBe(1);
      expect(stats.total).toBe(3);
    });

    it('should handle empty diff', () => {
      const stats = calculateDiffStats('');
      expect(stats.additions).toBe(0);
      expect(stats.deletions).toBe(0);
      expect(stats.total).toBe(0);
    });
  });

  describe('formatDuration', () => {
    it('should format durations correctly', () => {
      expect(formatDuration(1000)).toBe('1s');
      expect(formatDuration(61000)).toBe('1m 1s');
      expect(formatDuration(3661000)).toBe('1h 1m');
    });
  });

  describe('sanitizeText', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeText('<script>alert("test")</script>')).toBe(
        'scriptalert("test")/script'
      );
      expect(sanitizeText('javascript:alert(1)')).toBe('alert(1)');
      expect(sanitizeText('onclick="alert(1)"')).toBe('"alert(1)"');
    });

    it('should handle empty input', () => {
      expect(sanitizeText('')).toBe('');
      expect(sanitizeText(null)).toBe('');
      expect(sanitizeText(undefined)).toBe('');
    });
  });

  describe('chunkArray', () => {
    it('should chunk arrays correctly', () => {
      const array = [1, 2, 3, 4, 5, 6, 7];
      const chunks = chunkArray(array, 3);

      expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    });

    it('should handle empty arrays', () => {
      expect(chunkArray([], 3)).toEqual([]);
    });
  });
});
