import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiClient } from '../config';

function Login({ isAuthenticated, onAuthSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

    try {
      await apiClient.post(endpoint, { email, password });
      onAuthSuccess();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    }
  };

  return (
    <div className="auth-container" style={{maxWidth: '400px', margin: '50px auto', padding: '30px', background: 'white', borderRadius: '12px', color: '#333'}}>
      <h2 style={{marginBottom: '20px'}}>{isLogin ? 'Sign In' : 'Create Account'}</h2>
      {error && <div className="status-message error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input type="email" placeholder="Email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="form-group">
          <input type="password" placeholder="Password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit" className="submit-btn">{isLogin ? 'Login' : 'Register'}</button>
      </form>
      <p style={{marginTop: '20px', textAlign: 'center', cursor: 'pointer', color: '#218341'}} onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
      </p>
    </div>
  );
}

export default Login;
