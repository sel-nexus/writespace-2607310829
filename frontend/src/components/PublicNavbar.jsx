/** Provide public entry points and a role-aware return to the writing space. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';
import { getRoleHome } from '../utils/auth.js';

/** Render guest actions or the current account's dashboard link. */
export function PublicNavbar({ session = null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white shadow-sm">
      <nav aria-label="Public navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link to="/" className="rounded font-[Georgia] text-2xl font-bold text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500">
          WriteSpace
        </Link>
        {session ? (
          <div className="flex flex-wrap items-center gap-3">
            <Avatar role={session.role} />
            <span className="max-w-32 truncate font-medium text-slate-800">{session.displayName}</span>
            <Link to={getRoleHome(session)} className="rounded-lg px-3 py-2 text-indigo-700 hover:bg-indigo-50 focus-visible:ring-2">
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-lg px-3 py-2 font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:ring-2">
              Login
            </Link>
            <Link to="/register" className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 focus-visible:ring-2">
              Get Started
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}

PublicNavbar.propTypes = {
  session: PropTypes.shape({ role: PropTypes.string, displayName: PropTypes.string }),
};
