/** Display account metadata as a desktop row or a mobile card, never credentials. */
import PropTypes from 'prop-types';
import { Avatar } from './Avatar.jsx';
import { DEFAULT_ADMIN } from '../utils/auth.js';
import { formatDate } from '../utils/posts.js';

/** Render one account with a protected, explained delete control.
 * Args: user: Account metadata. currentUserId: Signed-in identity. onDelete: Confirmation handler.
 * mobile: Render a stacked card rather than a table row.
 * Returns: Account metadata and an eligible delete action; never renders password.
 */
export function UserRow({ user, currentUserId, onDelete, mobile = false }) {
  const reason = user.id === DEFAULT_ADMIN.id ? 'Default admin cannot be deleted.'
    : user.id === currentUserId ? 'You cannot delete your current account.' : '';
  const identity = (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar role={user.role} />
      <span className="min-w-0 break-words font-medium text-slate-900">{user.displayName}</span>
    </div>
  );
  const badge = (
    <span className={`inline-block rounded-full px-3 py-0.5 text-sm font-medium ring-1 ${user.role === 'admin'
      ? 'bg-violet-100 text-violet-700 ring-violet-300' : 'bg-indigo-100 text-indigo-700 ring-indigo-300'}`}>
      {user.role === 'admin' ? 'Admin' : 'user'}
    </span>
  );
  const control = (
    <span title={reason || undefined} className="inline-block">
      <button
        type="button"
        disabled={Boolean(reason)}
        title={reason || undefined}
        aria-label={`Delete ${user.username}`}
        onClick={() => onDelete(user)}
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-red-600 hover:bg-red-100
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Delete
      </button>
      {reason && <span className="sr-only">{reason}</span>}
    </span>
  );

  if (mobile) {
    return (
      <article aria-label={`Account ${user.username}`} className="rounded-xl border border-slate-200 bg-white p-4">
        {identity}
        <dl className="my-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
          <dt className="text-slate-500">Username</dt>
          <dd className="break-all">{user.username}</dd>
          <dt className="text-slate-500">Role</dt>
          <dd>{badge}</dd>
          <dt className="text-slate-500">Created</dt>
          <dd><time dateTime={user.createdAt}>{formatDate(user.createdAt)}</time></dd>
        </dl>
        {control}
      </article>
    );
  }
  return (
    <tr className="border-t border-slate-100">
      <th scope="row" className="px-4 py-4 text-left">{identity}</th>
      <td className="break-all px-4 py-4 text-sm">{user.username}</td>
      <td className="px-4 py-4">{badge}</td>
      <td className="px-4 py-4 text-sm text-slate-500">
        <time dateTime={user.createdAt}>{formatDate(user.createdAt)}</time>
      </td>
      <td className="px-4 py-4 text-right">{control}</td>
    </tr>
  );
}

UserRow.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired, displayName: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired, role: PropTypes.oneOf(['admin', 'user']).isRequired,
    createdAt: PropTypes.string.isRequired,
  }).isRequired,
  currentUserId: PropTypes.string,
  onDelete: PropTypes.func.isRequired,
  mobile: PropTypes.bool,
};
