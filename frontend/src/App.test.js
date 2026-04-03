import { apiUrl, publicShortUrl } from './config';

test('builds API and public URLs from config defaults', () => {
  expect(apiUrl('/api/shorten')).toBe('http://localhost:5000/api/shorten');
  expect(publicShortUrl('abc123')).toBe('http://localhost:5000/abc123');
});
