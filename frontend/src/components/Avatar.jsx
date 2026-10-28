/** Render the requested role-distinct avatar glyphs. */
import PropTypes from 'prop-types';

/** Return a styled, accessible role avatar.
 * Args: role (string): admin or user; unknown roles use the member treatment.
 * Returns: Static JSX with an accessible role label.
 * @param {string} role
 * @returns {import('react').ReactElement}
 */
export function getAvatar(role) {
  const admin = role === 'admin';
  return (
    <span
      role="img"
      aria-label={admin ? 'Admin avatar' : 'Member avatar'}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${admin ? 'bg-violet-600' : 'bg-indigo-500'}`}
    >
      <span aria-hidden="true">{admin ? '👑' : '📚'}</span>
    </span>
  );
}

/** Display the avatar for an account role. */
export function Avatar({ role }) {
  return getAvatar(role);
}

Avatar.propTypes = { role: PropTypes.string.isRequired };
