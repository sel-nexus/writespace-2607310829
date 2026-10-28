/** Authenticate demo accounts with accessible inline feedback. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getRoleHome, getSession, login } from '../utils/auth.js';

/** Show a login card or redirect an already authenticated account. */
export default function LoginPage({ onSessionChange }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const session = getSession();
  if (session) return <Navigate to={getRoleHome(session)} replace />;

  /** Validate required input and navigate only after the session is saved. */
  function submit(event) {
    event.preventDefault();
    const next = {};
    if (!username.trim()) next.username = 'Username is required.';
    if (!password.trim()) next.password = 'Password is required.';
    setErrors(next);
    setError('');
    if (Object.keys(next).length) return;
    try {
      const current = login(username, password);
      onSessionChange();
      navigate(getRoleHome(current), { replace: true });
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <main id="main-content" className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-slate-50 px-4 py-12 text-slate-800">
      <section aria-labelledby="login-heading" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-10">
        <Link to="/" className="rounded font-[Georgia] text-xl font-bold text-indigo-600 focus-visible:ring-2">WriteSpace</Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-widest text-indigo-700">Your local writing space</p>
        <h1 id="login-heading" className="mt-2 font-[Georgia] text-4xl font-bold tracking-tight">Welcome back.</h1>
        <p className="mt-3 text-slate-600">Log in to read, write, and find your next idea.</p>
        <form noValidate onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="login-username" className="block text-sm font-medium">Username</label>
            <input
              id="login-username"
              name="username"
              autoComplete="username"
              required
              aria-required="true"
              aria-invalid={Boolean(errors.username)}
              aria-describedby={errors.username ? 'login-username-error' : undefined}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.username && (
              <p id="login-username-error" role="alert" className="mt-2 text-sm text-red-600">{errors.username}</p>
            )}
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-required="true"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.password && (
              <p id="login-password-error" role="alert" className="mt-2 text-sm text-red-600">{errors.password}</p>
            )}
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white shadow-sm
              hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Login
          </button>
        </form>
        <p className="mt-6 text-sm text-slate-600">
          New here?
          <Link to="/register" className="ml-1 rounded font-medium text-indigo-700 underline focus-visible:ring-2">Register</Link>
        </p>
        <aside className="mt-8 rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
          <p className="font-semibold text-slate-800">Demo credentials: admin / admin</p>
          <p className="mt-1">Local-only demo. Passwords are stored in plaintext in this browser. Do not use real passwords or sensitive data.</p>
        </aside>
      </section>
    </main>
  );
}

LoginPage.propTypes = { onSessionChange: PropTypes.func.isRequired };
