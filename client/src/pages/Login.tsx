import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      const tokenData = JSON.parse(atob(localStorage.getItem('auth_token')!.split('.')[1]));
      navigate(tokenData.role === 'admin' ? '/' : '/teacher', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* Left brand panel */}
      <div className="login-left">
        <div className="login-brand-mark">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="white">
            <circle cx="9" cy="9" r="2.2"/><circle cx="15" cy="9" r="2.2"/>
            <path d="M5.5 16.5s2-3 6.5-3 6.5 3 6.5 3" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="12" r="10.5" fill="none" stroke="white" strokeWidth="1.5"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="login-brand-name">punch.</div>
          <div className="login-brand-sub">Tuition Centre<br/>Management System</div>
        </div>
        <div style={{ marginTop: 48, textAlign: 'center', maxWidth: 280 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { icon: '👨‍🏫', label: 'Teacher management' },
              { icon: '🎒', label: 'Student tracking' },
              { icon: '📊', label: 'Revenue reports' },
              { icon: '🧾', label: 'Invoices & receipts' },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#9ca3af', fontSize: 13.5 }}>
                <span style={{ fontSize: 20 }}>{f.icon}</span>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="login-right">
        <div className="login-card">
          <div className="login-logo">
            <h1>punch.</h1>
            <span>Sign in to your account</span>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <h2>Welcome back</h2>
            <p>Enter your credentials to continue</p>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              style={{ marginTop: 8, padding: '11px 18px', fontSize: 14 }}
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="login-hint" style={{ marginTop: 20 }}>
            Punch Tuition Centre · Centre Management System
          </p>
        </div>
      </div>
    </div>
  );
}
