'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [theme, setTheme] = useState('dark');
  const [userNumber, setUserNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let saved = 'dark';
    try { saved = localStorage.getItem('crm_theme') || 'dark'; } catch {}
    setTheme(saved);
  }, []);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          router.replace('/');
          return;
        }
      } catch {}
      setCheckingSession(false);
    }
    checkSession();
  }, [router]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('crm_theme', next); } catch {}
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!userNumber.trim() || !password) {
      setError('Please enter both user number and password');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userNumber: userNumber.trim(), password }),
      });
      const result = await res.json();
      if (result.success) {
        router.push('/');
      } else {
        setError(result.message || 'Login failed');
        setLoading(false);
      }
    } catch {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="login-body" data-theme={theme}>
        <LoginStyles />
        <div className="login-container">
          <div id="loadingScreen" style={{ display: 'block' }}>
            <div className="big-spinner" />
            <h3>Verifying session...</h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-body" data-theme={theme}>
      <LoginStyles />
      <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
        <span>{theme === 'dark' ? '🌙' : '☀️'}</span>
      </button>

      <div className="login-container">
        <div className="login-header">
          <div className="logo-icon">🏢</div>
          <h1>Channel Partner CRM</h1>
          <p>Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin}>
          {error && <div className="error-msg" style={{ display: 'block' }}>{error}</div>}

          <div className="form-group">
            <label>User Number</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={userNumber}
                onChange={(e) => setUserNumber(e.target.value)}
                placeholder="Enter your user number"
                autoComplete="username"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <i
                className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} toggle-password`}
                onClick={() => setShowPassword((s) => !s)}
              />
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (<><span className="spinner" /> Signing in...</>) : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

function LoginStyles() {
  return (
    <style jsx global>{`
      :root, [data-theme="dark"] {
        --bg-gradient: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
        --card-bg: rgba(255,255,255,0.05);
        --card-border: rgba(255,255,255,0.1);
        --input-bg: rgba(255,255,255,0.08);
        --input-border: rgba(255,255,255,0.15);
        --input-focus-bg: rgba(255,255,255,0.12);
        --text-primary: #ffffff;
        --text-secondary: rgba(255,255,255,0.7);
        --text-muted: rgba(255,255,255,0.5);
        --primary: #667eea;
        --secondary: #764ba2;
        --shadow: 0 25px 50px rgba(0,0,0,0.3);
        --toggle-bg: rgba(255,255,255,0.1);
      }
      [data-theme="light"] {
        --bg-gradient: linear-gradient(135deg, #e0e7ff, #c7d2fe, #ddd6fe);
        --card-bg: rgba(255,255,255,0.95);
        --card-border: rgba(0,0,0,0.08);
        --input-bg: rgba(255,255,255,1);
        --input-border: rgba(0,0,0,0.15);
        --input-focus-bg: rgba(255,255,255,1);
        --text-primary: #1a202c;
        --text-secondary: rgba(0,0,0,0.7);
        --text-muted: rgba(0,0,0,0.5);
        --primary: #667eea;
        --secondary: #764ba2;
        --shadow: 0 25px 50px rgba(0,0,0,0.15);
        --toggle-bg: rgba(0,0,0,0.08);
      }
      .login-body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: var(--bg-gradient);
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        transition: background 0.4s ease;
      }
      .theme-toggle {
        position: fixed; top: 20px; right: 20px;
        width: 50px; height: 50px; background: var(--toggle-bg);
        border: 1px solid var(--card-border); border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; font-size: 22px; transition: all 0.3s; z-index: 100;
      }
      .theme-toggle:hover { transform: rotate(20deg) scale(1.1); background: var(--card-bg); }
      .login-container {
        background: var(--card-bg); backdrop-filter: blur(20px);
        border: 1px solid var(--card-border); border-radius: 20px;
        padding: 50px 40px; width: 420px; max-width: 95vw;
        box-shadow: var(--shadow); transition: all 0.3s;
      }
      .login-header { text-align: center; margin-bottom: 40px; }
      .logo-icon {
        width: 70px; height: 70px; background: linear-gradient(135deg, var(--primary), var(--secondary));
        border-radius: 20px; display: flex; align-items: center; justify-content: center;
        margin: 0 auto 15px; font-size: 30px; color: white;
      }
      .login-header h1 { color: var(--text-primary); font-size: 24px; font-weight: 600; }
      .login-header p { color: var(--text-muted); font-size: 14px; margin-top: 5px; }
      .form-group { margin-bottom: 25px; position: relative; }
      .form-group label { color: var(--text-secondary); font-size: 13px; display: block; margin-bottom: 8px; font-weight: 500; }
      .input-wrapper { position: relative; width: 100%; }
      .input-wrapper input {
        width: 100%; padding: 14px 18px; padding-right: 45px;
        background: var(--input-bg); border: 1px solid var(--input-border);
        border-radius: 12px; color: var(--text-primary); font-size: 15px;
        transition: all 0.3s; outline: none;
      }
      .input-wrapper input:focus { border-color: var(--primary); background: var(--input-focus-bg); box-shadow: 0 0 0 3px rgba(102,126,234,0.2); }
      .input-wrapper input::placeholder { color: var(--text-muted); opacity: 0.5; }
      .toggle-password {
        position: absolute; right: 15px; top: 50%; transform: translateY(-50%);
        color: var(--text-muted); cursor: pointer; transition: color 0.3s; font-size: 16px;
      }
      .toggle-password:hover { color: var(--primary); }
      .login-btn {
        width: 100%; padding: 15px; background: linear-gradient(135deg, var(--primary), var(--secondary));
        color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600;
        cursor: pointer; transition: all 0.3s; margin-top: 10px;
      }
      .login-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(102,126,234,0.4); }
      .login-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
      .error-msg {
        background: rgba(255,82,82,0.15); border: 1px solid rgba(255,82,82,0.3);
        color: #ff5252; padding: 12px 16px; border-radius: 10px; font-size: 13px; margin-bottom: 20px; text-align: center;
      }
      .spinner {
        display: inline-block; width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite;
        vertical-align: middle; margin-right: 8px;
      }
      .big-spinner {
        display: inline-block; width: 40px; height: 40px; border: 3px solid var(--primary);
        border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      #loadingScreen { text-align: center; color: var(--text-primary); padding: 40px 0; }
      #loadingScreen h3 { margin-top: 15px; font-size: 16px; font-weight: 500; color: var(--text-secondary); }
    `}</style>
  );
}