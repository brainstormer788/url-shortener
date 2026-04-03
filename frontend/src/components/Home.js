import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient } from '../config';

function Home({ isAuthenticated }) {
  const [longUrl, setLongUrl] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) return; // Failsafe

    setError(''); setShortUrl(''); setIsLoading(true);

    let formattedUrl = longUrl;
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    try {
      const response = await apiClient.post('/api/shorten', {
        longUrl: formattedUrl,
        customAlias: customAlias.trim() !== '' ? customAlias : undefined
      });
      setShortUrl(response.data.shortUrl);
    } catch (err) {
      setError(err.response?.data?.error || 'Error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="main-content">
      <div className="left-column">
        <div className="shortener-card">
          
          {isAuthenticated ? (
            /* --- SHOW THIS IF LOGGED IN --- */
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="section-title">🔗 Shorten a long URL</label>
                <input 
                  type="url" 
                  className="input-field" 
                  placeholder="https://..." 
                  value={longUrl} 
                  onChange={(e) => setLongUrl(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="section-title">✏️ Customize your link</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="custom-alias" 
                  value={customAlias} 
                  onChange={(e) => setCustomAlias(e.target.value)} 
                />
              </div>

              {error && <div className="status-message error-message">{error}</div>}
              {shortUrl && (
                <div className="status-message success-message">
                  <p>Success! <a href={shortUrl} target="_blank" rel="noreferrer">{shortUrl}</a></p>
                  <QRCodeSVG value={shortUrl} size={100} style={{marginTop: '10px'}} />
                </div>
              )}

              <button type="submit" className="submit-btn" disabled={isLoading}>
                {isLoading ? 'Shortening...' : 'Shorten URL'}
              </button>
            </form>
          ) : (
            /* --- SHOW THIS IF GUEST --- */
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <h2 style={{ color: '#333', marginBottom: '15px' }}>Ready to shorten?</h2>
              <p style={{ color: '#666', marginBottom: '25px' }}>
                Join TinyURL to create shortened links, customize your aliases, and track your link analytics.
              </p>
              <Link to="/login" className="submit-btn" style={{ textDecoration: 'none', display: 'block' }}>
                Sign in to get started
              </Link>
            </div>
          )}

        </div>
      </div>

      <div className="right-column">
        <h1 className="hero-title">The Original URL Shortener</h1>
        <p className="hero-description">
          Log in to unlock custom aliases, QR codes, and your personal link dashboard.
        </p>
      </div>
    </main>
  );
}

export default Home;
