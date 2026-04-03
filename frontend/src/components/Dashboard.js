import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient, publicShortUrl } from '../config';

const numberFormatter = new Intl.NumberFormat('en-US');
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function truncateText(value, maxLength = 48) {
  if (!value) {
    return '';
  }

  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function getHostname(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch (error) {
    return 'invalid-url';
  }
}

function MetricCard({ label, value, caption, accent }) {
  return (
    <article className={`metric-card ${accent}`}>
      <p className="metric-label">{label}</p>
      <h3 className="metric-value">{value}</h3>
      <p className="metric-caption">{caption}</p>
    </article>
  );
}

function BarChart({ items }) {
  if (items.length === 0) {
    return <p className="analytics-empty-copy">Your top performing links will show up here after the first click.</p>;
  }

  const maxClicks = Math.max(...items.map((item) => item.clicks), 1);

  return (
    <div className="bar-chart">
      {items.map((item) => {
        const width = `${Math.max((item.clicks / maxClicks) * 100, item.clicks > 0 ? 8 : 0)}%`;
        return (
          <div className="bar-row" key={item._id}>
            <div className="bar-row-header">
              <div>
                <p className="bar-row-title">{truncateText(item.shortCode, 18)}</p>
                <p className="bar-row-subtitle">{truncateText(item.longUrl, 38)}</p>
              </div>
              <span className="bar-row-value">{numberFormatter.format(item.clicks)} clicks</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityChart({ values }) {
  const maxValue = Math.max(...values.map((item) => item.count), 1);

  return (
    <div className="activity-chart">
      {values.map((item) => (
        <div className="activity-column" key={item.label}>
          <div className="activity-bar-shell">
            <div
              className="activity-bar-fill"
              style={{ height: `${Math.max((item.count / maxValue) * 100, item.count > 0 ? 10 : 0)}%` }}
            />
          </div>
          <span className="activity-value">{item.count}</span>
          <span className="activity-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function Dashboard({ isAuthenticated, onLogout }) {
  const [urls, setUrls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [loadError, setLoadError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMyUrls = async () => {
      if (!isAuthenticated) {
        navigate('/login');
        setIsLoading(false);
        return;
      }

      try {
        const response = await apiClient.get('/api/myurls');
        setUrls(response.data);
      } catch (err) {
        if (err.response?.status === 401) {
          await onLogout();
          navigate('/login');
          return;
        }

        setLoadError(err.response?.data?.error || 'We could not load your analytics right now.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyUrls();
  }, [isAuthenticated, navigate, onLogout]);

  const analytics = useMemo(() => {
    const totalLinks = urls.length;
    const totalClicks = urls.reduce((sum, url) => sum + (url.clicks || 0), 0);
    const activeLinks = urls.filter((url) => (url.clicks || 0) > 0).length;
    const zeroClickLinks = totalLinks - activeLinks;
    const averageClicks = totalLinks > 0 ? (totalClicks / totalLinks).toFixed(totalClicks % totalLinks === 0 ? 0 : 1) : '0';
    const topLink = [...urls].sort((a, b) => (b.clicks || 0) - (a.clicks || 0))[0] || null;

    const hostCounts = urls.reduce((accumulator, url) => {
      const host = getHostname(url.longUrl);
      accumulator[host] = (accumulator[host] || 0) + 1;
      return accumulator;
    }, {});

    const domainBreakdown = Object.entries(hostCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([host, count]) => ({ host, count }));

    const topLinks = [...urls]
      .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
      .slice(0, 5);

    const weekdayMap = urls.reduce((accumulator, url) => {
      const weekday = new Date(url.date).getDay();
      accumulator[weekday] += 1;
      return accumulator;
    }, [0, 0, 0, 0, 0, 0, 0]);

    const weeklyActivity = weekdayLabels.map((label, index) => ({
      label,
      count: weekdayMap[index]
    }));

    return {
      totalLinks,
      totalClicks,
      activeLinks,
      zeroClickLinks,
      averageClicks,
      topLink,
      domainBreakdown,
      topLinks,
      weeklyActivity
    };
  }, [urls]);

  const engagementRatio = analytics.totalLinks > 0
    ? Math.round((analytics.activeLinks / analytics.totalLinks) * 100)
    : 0;

  const copyToClipboard = async (shortUrl, id) => {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2500);
    } catch (error) {
      setLoadError('Clipboard access failed. You can still open the short link directly.');
    }
  };

  if (isLoading) {
    return <div className="dashboard-loading">Loading your analytics...</div>;
  }

  return (
    <section className="analytics-page">
      <div className="analytics-hero">
        <div>
          <p className="analytics-kicker">Analytics Overview</p>
          <h1 className="analytics-title">See which links are gaining traction and where your momentum is building.</h1>
          <p className="analytics-description">
            Track total clicks, discover your best-performing short links, and spot publishing patterns across your dashboard.
          </p>
        </div>
        <Link to="/" className="analytics-cta">
          Create New Link
        </Link>
      </div>

      {loadError && <div className="status-message error-message">{loadError}</div>}

      <div className="metrics-grid">
        <MetricCard
          label="Total Links"
          value={numberFormatter.format(analytics.totalLinks)}
          caption="All shortened links in your account"
          accent="accent-ocean"
        />
        <MetricCard
          label="Total Clicks"
          value={numberFormatter.format(analytics.totalClicks)}
          caption="Combined traffic across every short URL"
          accent="accent-emerald"
        />
        <MetricCard
          label="Average Clicks"
          value={analytics.averageClicks}
          caption="Average engagement per link"
          accent="accent-amber"
        />
        <MetricCard
          label="Top Performer"
          value={analytics.topLink ? analytics.topLink.shortCode : 'None yet'}
          caption={analytics.topLink ? `${numberFormatter.format(analytics.topLink.clicks)} clicks so far` : 'Create a link to start collecting data'}
          accent="accent-rose"
        />
      </div>

      <div className="analytics-grid">
        <article className="analytics-panel analytics-panel-wide">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Leaderboard</p>
              <h2>Top links by clicks</h2>
            </div>
            <span className="panel-badge">Live ranking</span>
          </div>
          <BarChart items={analytics.topLinks} />
        </article>

        <article className="analytics-panel">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Engagement Mix</p>
              <h2>Clicked vs quiet links</h2>
            </div>
          </div>
          <div className="engagement-ring-wrap">
            <div
              className="engagement-ring"
              style={{
                background: `conic-gradient(#1f8f62 0% ${engagementRatio}%, #dbe7e1 ${engagementRatio}% 100%)`
              }}
            >
              <div className="engagement-ring-center">
                <strong>{engagementRatio}%</strong>
                <span>active</span>
              </div>
            </div>
            <div className="engagement-legend">
              <div className="legend-row">
                <span className="legend-dot legend-dot-active" />
                <span>{analytics.activeLinks} clicked links</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot legend-dot-idle" />
                <span>{analytics.zeroClickLinks} waiting for first click</span>
              </div>
            </div>
          </div>
        </article>

        <article className="analytics-panel">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Publishing Rhythm</p>
              <h2>Links created by weekday</h2>
            </div>
          </div>
          <ActivityChart values={analytics.weeklyActivity} />
        </article>

        <article className="analytics-panel">
          <div className="panel-header">
            <div>
              <p className="panel-eyebrow">Source Domains</p>
              <h2>Where your long URLs come from</h2>
            </div>
          </div>
          <div className="domain-list">
            {analytics.domainBreakdown.length === 0 ? (
              <p className="analytics-empty-copy">Add your first shortened link to unlock domain insights.</p>
            ) : (
              analytics.domainBreakdown.map((item, index) => (
                <div className="domain-row" key={item.host}>
                  <div className="domain-rank">{index + 1}</div>
                  <div className="domain-meta">
                    <p>{item.host}</p>
                    <span>{item.count} link{item.count === 1 ? '' : 's'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      <article className="analytics-table-panel">
        <div className="panel-header">
          <div>
            <p className="panel-eyebrow">Full Library</p>
            <h2>All shortened links</h2>
          </div>
          <span className="panel-badge">{analytics.totalLinks} tracked</span>
        </div>

        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Original URL</th>
                <th>Short URL</th>
                <th>Clicks</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {urls.length === 0 ? (
                <tr>
                  <td colSpan="5" className="analytics-table-empty">
                    You have not created any links yet. <Link to="/">Create one now.</Link>
                  </td>
                </tr>
              ) : (
                urls.map((url) => {
                  const fullShortUrl = publicShortUrl(url.shortCode);
                  return (
                    <tr key={url._id}>
                      <td className="analytics-url-cell">
                        <a href={url.longUrl} target="_blank" rel="noreferrer">
                          {truncateText(url.longUrl, 58)}
                        </a>
                        <span>{getHostname(url.longUrl)}</span>
                      </td>
                      <td>
                        <a href={fullShortUrl} target="_blank" rel="noreferrer" className="short-link-pill">
                          {url.shortCode}
                        </a>
                      </td>
                      <td className="analytics-clicks">{numberFormatter.format(url.clicks || 0)}</td>
                      <td className="analytics-date">{dateFormatter.format(new Date(url.date))}</td>
                      <td>
                        <button
                          onClick={() => copyToClipboard(fullShortUrl, url._id)}
                          className="copy-btn"
                        >
                          {copiedId === url._id ? 'Copied!' : 'Copy'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

export default Dashboard;
