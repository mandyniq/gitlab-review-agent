const pattern = /^https?:\/\/[^/]+\/[^/]+(?:\/[^/]+)*\/-\/merge_requests\/\d+$/;
const testUrl =
  'https://gitlab.td.gfk.com/ecosystem/platform-domain/microfrontends/design-system/-/merge_requests/760';

console.log('Testing your URL:');
console.log('URL:', testUrl);
console.log('Matches pattern:', pattern.test(testUrl));

// Test extraction
const extractPattern = /^(https?:\/\/[^/]+)\/(.*)\/-\/merge_requests\/(\d+)$/;
const match = testUrl.match(extractPattern);
if (match) {
  console.log('Base URL:', match[1]);
  console.log('Project Path:', match[2]);
  console.log('MR IID:', match[3]);
} else {
  console.log('Failed to extract details');
}

// Test other URLs too
const testUrls = [
  'https://gitlab.td.gfk.com/group/project/-/merge_requests/123',
  'https://gitlab.td.gfk.com/ecosystem/platform-domain/microfrontends/design-system/-/merge_requests/760',
  'https://gitlab.example.com/a/b/c/d/e/-/merge_requests/999',
];

console.log('\nTesting multiple URLs:');
testUrls.forEach((url) => {
  console.log(`${url}: ${pattern.test(url)}`);
});
