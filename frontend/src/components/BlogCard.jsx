/** Present an actual local publication as a safe, navigable summary. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Avatar } from './Avatar.jsx';
import { getAllUsers, getSession } from '../utils/auth.js';
import { canManagePost, formatDate } from '../utils/posts.js';

const accents = ['border-indigo-500', 'border-violet-500', 'border-pink-500', 'border-teal-500'];

/** Render plain-text excerpts and separate eligible edit navigation.
 * Args: post (object): Valid stored publication. index (number): Accent position.
 * session (object|null): Current display identity; null hides management links.
 */
export function BlogCard({ post, index = 0, session = getSession() }) {
  const role = getAllUsers().find((user) => user.id === post.authorId)?.role || 'user';
  const accent = accents[((index % 4) + 4) % 4] || accents[0];
  return (
    <article className={`flex h-full min-w-0 flex-col rounded-xl border border-t-4 bg-white p-6 ${accent}`}>
      <Link
        to={`/blog/${encodeURIComponent(post.id)}`}
        aria-label={`Read ${post.title}`}
        className="group block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <h2 className="break-words font-[Georgia] text-2xl font-bold leading-tight text-slate-800 group-hover:text-indigo-700">
          {post.title}
        </h2>
        <p className="mt-4 break-words text-sm leading-7 text-slate-600">{post.content.slice(0, 120)}</p>
      </Link>
      <div className="mt-auto flex items-center gap-3 pt-6">
        <Avatar role={role} />
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-slate-800">{post.authorName}</p>
          <time dateTime={post.createdAt} className="text-sm text-slate-500">{formatDate(post.createdAt)}</time>
        </div>
        {canManagePost(post, session) && (
          <Link
            to={`/edit/${encodeURIComponent(post.id)}`}
            aria-label={`Edit ${post.title}`}
            className="ml-auto rounded-lg px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:ring-2"
          >
            Edit
          </Link>
        )}
      </div>
    </article>
  );
}

BlogCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired,
    authorId: PropTypes.string.isRequired,
    authorName: PropTypes.string.isRequired,
  }).isRequired,
  index: PropTypes.number,
  session: PropTypes.shape({ userId: PropTypes.string, role: PropTypes.string }),
};
