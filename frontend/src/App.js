import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import Home from './components/Home';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { apiClient } from './config';
import './App.css';

function Navigation({ isAuthenticated, onLogout }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await onLogout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="logo"><Link to="/">TINYURL</Link></div>
      <div className="nav-links">
        {isAuthenticated ? (
          <>
            <Link to="/dashboard">Analytics</Link>
            <button onClick={handleLogout} className="nav-btn-light" style={{cursor: 'pointer', background: 'transparent'}}>Logout</button>
          </>
        ) : (
          <Link to="/login" className="nav-btn-dark">Sign In</Link>
        )}
      </div>
    </nav>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await apiClient.get('/api/auth/me');
        setIsAuthenticated(true);
      } catch (error) {
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch (error) {
      // Ignore logout errors and clear client auth state anyway.
    } finally {
      setIsAuthenticated(false);
    }
  };

  if (isCheckingAuth) {
    return <div className="dashboard-loading">Checking session...</div>;
  }

  return (
    <Router>
      <div className="app-container">
        <Navigation isAuthenticated={isAuthenticated} onLogout={handleLogout} />
        <Routes>
          <Route path="/" element={<Home isAuthenticated={isAuthenticated} />} />
          <Route path="/login" element={<Login isAuthenticated={isAuthenticated} onAuthSuccess={handleAuthSuccess} />} />
          <Route path="/dashboard" element={<Dashboard isAuthenticated={isAuthenticated} onLogout={handleLogout} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
