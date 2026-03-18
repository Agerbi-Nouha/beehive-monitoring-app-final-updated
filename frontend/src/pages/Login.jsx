import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@local.dev');
  const [password, setPassword] = useState('admin1234');
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message || 'Login failed');
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center honeycomb-bg p-6">
      <div className="card w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent text-lg">🐝</div>
          <div>
            <div className="text-lg font-semibold">Sign in</div>
            <div className="text-sm text-muted">Viewer/Admin access</div>
          </div>
        </div>

        {error && <div className="mb-3 text-sm text-danger">{error}</div>}

        <form className="space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="text-sm text-muted">Email</label>
            <input className="input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted">Password</label>
            <input className="input mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary w-full" type="submit">
            Login
          </button>
        </form>

        <div className="mt-4 text-xs text-muted">
          Default (dev): admin@local.dev / admin1234 (auto-seeded if AUTO_SEED_ADMIN=true)
        </div>
      </div>
    </div>
  );
}
