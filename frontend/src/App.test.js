describe('config URL helpers', () => {
  const originalApiUrl = process.env.REACT_APP_API_URL;
  const originalPublicBaseUrl = process.env.REACT_APP_PUBLIC_BASE_URL;

  afterEach(() => {
    if (originalApiUrl === undefined) {
      delete process.env.REACT_APP_API_URL;
    } else {
      process.env.REACT_APP_API_URL = originalApiUrl;
    }

    if (originalPublicBaseUrl === undefined) {
      delete process.env.REACT_APP_PUBLIC_BASE_URL;
    } else {
      process.env.REACT_APP_PUBLIC_BASE_URL = originalPublicBaseUrl;
    }

    jest.resetModules();
  });

  test('builds API and public URLs from env values', async () => {
    process.env.REACT_APP_API_URL = 'https://url-shortener-bob2.onrender.com/';
    process.env.REACT_APP_PUBLIC_BASE_URL = 'https://tiny.example.com/';
    jest.resetModules();

    const { apiUrl, publicShortUrl } = await import('./config');

    expect(apiUrl('/api/shorten')).toBe('https://url-shortener-bob2.onrender.com/api/shorten');
    expect(publicShortUrl('abc123')).toBe('https://tiny.example.com/abc123');
  });

  test('falls back to localhost defaults when env values are missing', async () => {
    delete process.env.REACT_APP_API_URL;
    delete process.env.REACT_APP_PUBLIC_BASE_URL;
    jest.resetModules();

    const { apiUrl, publicShortUrl } = await import('./config');

    expect(apiUrl('/api/shorten')).toBe('http://localhost:5000/api/shorten');
    expect(publicShortUrl('abc123')).toBe('http://localhost:5000/abc123');
  });
});
