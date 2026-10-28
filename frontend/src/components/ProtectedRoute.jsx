/** Fail closed on missing sessions and restrict administration routes. */
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { getSession } from '../utils/auth.js';

/** Gate children using the currently persisted account rather than a cached role. */
export function ProtectedRoute({ children, adminOnly = false }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (adminOnly && session.role !== 'admin') return <Navigate to="/blogs" replace />;
  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  adminOnly: PropTypes.bool,
};
