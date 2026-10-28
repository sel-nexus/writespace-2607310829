/** Provide persistent role-aware navigation and resilient local logout. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';
import { clearSession } from '../utils/auth.js';

/** Render navigation, a responsive disclosure and an account logout disclosure. */
export function Navbar({ session, onSessionChange }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);
  const links = [['/blogs', 'All Blogs'], ['/write', 'Write']];
  if (session.role === 'admin') links.push(['/admin', 'Dashboard'], ['/users', 'Users']);

  /** Clear storage before refreshing the parent and navigating; retain errors on failure. */
  function logout() {
    try {
      clearSession();
      onSessionChange();
      navigate('/');
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white shadow-sm">
      <nav aria-label="Member navigation" className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-4">
        <Link to="/" className="mr-auto rounded font-[Georgia] text-2xl font-bold text-indigo-600 focus-visible:ring-2">
          WriteSpace
        </Link>
        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          aria-controls="member-links"
          onClick={() => setMenuOpen(!menuOpen)}
          className="rounded-lg border border-slate-200 p-2 text-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-500 sm:hidden"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="relative">
          <button
            type="button"
            aria-expanded={accountOpen}
            aria-controls="account-actions"
            aria-label={`Account: ${session.displayName}`}
            onClick={() => setAccountOpen(!accountOpen)}
            onKeyDown={(event) => { if (event.key === 'Escape') setAccountOpen(false); }}
            className="flex items-center gap-2 rounded-full p-1 pr-3 text-slate-800 hover:bg-slate-50 focus-visible:ring-2"
          >
            <Avatar role={session.role} />
            <span className="max-w-24 truncate text-sm font-medium sm:max-w-40">{session.displayName}</span>
          </button>
          {accountOpen && (
            <div id="account-actions" className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <button type="button" onClick={logout} className="w-full rounded-lg px-4 py-3 text-left text-red-600 hover:bg-red-50 focus-visible:ring-2">
                Logout
              </button>
            </div>
          )}
        </div>
        <div
          id="member-links"
          className={`${menuOpen ? 'flex' : 'hidden'} order-last w-full flex-col gap-1 sm:order-none sm:flex sm:w-auto sm:flex-row`}
          onKeyDown={(event) => { if (event.key === 'Escape') setMenuOpen(false); }}
        >
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium focus-visible:ring-2 ${
                isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
      {error && (
        <p role="alert" className="mx-auto max-w-6xl px-4 pb-3 text-red-600">{error}</p>
      )}
    </header>
  );
}

Navbar.propTypes = {
  session: PropTypes.shape({ role: PropTypes.string.isRequired, displayName: PropTypes.string.isRequired }).isRequired,
  onSessionChange: PropTypes.func.isRequired,
};
