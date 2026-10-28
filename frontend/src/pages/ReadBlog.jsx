/** Display complete plain text and safely confirm eligible post deletion. */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar.jsx';
import { getAllUsers, getSession } from '../utils/auth.js';
import { canManagePost, deletePost, formatDate, getPost } from '../utils/posts.js';

/** Render the current publication, or a recoverable missing-post message. */
export default function ReadBlog() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const post = getPost(id);
  const session = getSession();
  const role = getAllUsers().find((user) => user.id === post?.authorId)?.role || 'user';

  /** Confirm, then revalidate live ownership; navigate only after successful persistence. */
  function removePost() {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      deletePost(id);
      navigate('/blogs');
    } catch (cause) {
      setError(cause.message);
    }
  }

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-12 text-slate-800">
      <Link to="/blogs" className="inline-block rounded-lg px-3 py-2 text-indigo-700 hover:bg-indigo-50 focus-visible:ring-2">
        Back to All Posts
      </Link>
      {error && (
        <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>
      )}
      {post ? (
        <article className="mx-auto mt-8 max-w-3xl rounded-xl border border-slate-200 bg-white px-6 py-10 sm:px-12">
          <h1 className="break-words font-[Georgia] text-4xl font-bold leading-tight sm:text-5xl">{post.title}</h1>
          <div className="mt-8 flex items-center gap-3 border-b border-slate-100 pb-8">
            <Avatar role={role} />
            <div className="min-w-0">
              <p className="break-words font-medium">{post.authorName}</p>
              <time dateTime={post.createdAt} className="text-sm text-slate-500">{formatDate(post.createdAt)}</time>
            </div>
          </div>
          <div className="mt-8 whitespace-pre-wrap break-words text-lg leading-8 text-slate-800">{post.content}</div>
          {canManagePost(post, session) && (
            <div className="mt-10 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
              <Link
                to={`/edit/${encodeURIComponent(post.id)}`}
                className="rounded-lg border border-indigo-200 px-4 py-2 font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:ring-2"
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={removePost}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-600 hover:bg-red-100 focus-visible:ring-2"
              >
                Delete
              </button>
            </div>
          )}
        </article>
      ) : (
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-10">
          <h1 className="font-[Georgia] text-4xl font-bold">Post not found</h1>
          <p className="mt-4 text-slate-600">This post may have been removed, or the link is no longer valid.</p>
        </section>
      )}
    </main>
  );
}
