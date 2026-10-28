/** Create ordinary member accounts with per-field validation and auto-login. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { getRoleHome, getSession, register, validateUser } from '../utils/auth.js';

const fieldLabels = {
  displayName: 'Display Name', username: 'Username', password: 'Password', confirmPassword: 'Confirm Password',
};

/** Render the registration form and keep persistence errors visible without navigation. */
export default function RegisterPage({ onSessionChange }) {
  const [fields, setFields] = useState({ displayName: '', username: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const session = getSession();
  if (session) return <Navigate to={getRoleHome(session)} replace />;

  /** Validate and create a member before notifying the parent session owner. */
  function submit(event) {
    event.preventDefault();
    const next = validateUser({ ...fields, role: 'user' });
    setErrors(next);
    setError('');
    if (Object.keys(next).length) return;
    try {
      register(fields);
      onSessionChange();
      navigate('/blogs', { replace: true });
    } catch (cause) {
      setError(`${cause.message} If your account was saved, use Login to try again.`);
    }
  }

  return (
    <main id="main-content" className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-slate-50 px-4 py-12 text-slate-800">
      <section aria-labelledby="register-heading" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-10">
        <Link to="/" className="rounded font-[Georgia] text-xl font-bold text-indigo-600 focus-visible:ring-2">WriteSpace</Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-widest text-indigo-700">Make room for your ideas</p>
        <h1 id="register-heading" className="mt-2 font-[Georgia] text-4xl font-bold tracking-tight">Your space starts here.</h1>
        <p className="mt-3 text-slate-600">Create a local member account to join the writing space.</p>
        <form noValidate onSubmit={submit} className="mt-8 space-y-5">
          {Object.entries(fieldLabels).map(([key, label]) => (
            <div key={key}>
              <label htmlFor={`register-${key}`} className="block text-sm font-medium">{label}</label>
              <input
                id={`register-${key}`}
                name={key}
                type={key.includes('assword') ? 'password' : 'text'}
                autoComplete={key.includes('assword') ? 'new-password' : key === 'username' ? 'username' : 'nickname'}
                required
                aria-required="true"
                aria-invalid={Boolean(errors[key])}
                aria-describedby={errors[key] ? `register-${key}-error` : undefined}
                value={fields[key]}
                onChange={(event) => setFields({ ...fields, [key]: event.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3
                  focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors[key] && (
                <p id={`register-${key}-error`} role="alert" className="mt-2 text-sm text-red-600">{errors[key]}</p>
              )}
            </div>
          ))}
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white shadow-sm
              hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Create Account
          </button>
        </form>
        <p className="mt-6 text-sm text-slate-600">
          Already a member?
          <Link to="/login" className="ml-1 rounded font-medium text-indigo-700 underline focus-visible:ring-2">Login</Link>
        </p>
        <aside className="mt-8 rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
          <p>Local-only demo. Passwords are stored in plaintext in this browser. Do not use real passwords or sensitive data.</p>
          <p className="mt-1">Demo administrator: admin / admin</p>
        </aside>
      </section>
    </main>
  );
}

RegisterPage.propTypes = { onSessionChange: PropTypes.func.isRequired };
