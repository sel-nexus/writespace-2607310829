/** Show real local totals and the latest publications for administrators. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatCard } from '../components/StatCard.jsx';
import { getAllUsers } from '../utils/auth.js';
import { deletePost, formatDate, sortedPosts } from '../utils/posts.js';

/** Render administration overview and re-read posts after successful deletion. */
export default function AdminDashboard() {
  const [posts, setPosts] = useState(sortedPosts);
  const users = getAllUsers();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /** Confirm deletion and let the helper revalidate the live session and ownership. */
  function removePost(post) {
    setError('');
    setSuccess('');
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      deletePost(post.id);
      setPosts(sortedPosts());
      setSuccess('Post deleted.');
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <main id="main-content" className="mx-auto max-w-6xl space-y-8 px-4 py-10 text-slate-800">
      <header className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white sm:p-8">
        <p className="text-sm font-medium uppercase tracking-widest">Community overview</p>
        <h1 className="mt-2 font-[Georgia] text-3xl font-bold sm:text-4xl">Admin Dashboard</h1>
        <p className="mt-3 max-w-xl text-indigo-50">Keep your local writing community and its latest posts in view.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Posts" count={posts.length} accent="indigo" />
        <StatCard label="Total Users" count={users.length} accent="violet" />
        <StatCard label="Total Admins" count={users.filter((user) => user.role === 'admin').length} accent="pink" />
        <StatCard label="Total users" count={users.filter((user) => user.role === 'user').length} accent="teal" />
      </div>
      <section aria-labelledby="admin-actions">
        <h2 id="admin-actions" className="font-[Georgia] text-xl font-bold">Quick actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/write" className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 focus-visible:ring-2">
            Write New Post
          </Link>
          <Link to="/users" className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-indigo-700 focus-visible:ring-2">
            Manage Users
          </Link>
        </div>
      </section>
      <section aria-labelledby="recent-posts" className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 id="recent-posts" className="font-[Georgia] text-2xl font-bold">Recent Posts</h2>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
        {success && <p role="status" className="mt-4 rounded-lg bg-teal-50 p-3 text-teal-800">{success}</p>}
        {posts.length === 0 ? (
          <p className="mt-5 text-slate-500">No posts yet. Write your first post to get started.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {posts.slice(0, 5).map((post) => (
              <li key={post.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link to={`/blog/${encodeURIComponent(post.id)}`} className="break-words font-semibold text-slate-900 underline focus-visible:ring-2">
                    {post.title}
                  </Link>
                  <p className="mt-1 break-words text-sm text-slate-500">
                    {post.authorName} · <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link
                    to={`/edit/${encodeURIComponent(post.id)}`}
                    aria-label={`Edit ${post.title}`}
                    className="rounded-lg px-4 py-2 text-indigo-700 hover:bg-indigo-50 focus-visible:ring-2"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    aria-label={`Delete ${post.title}`}
                    onClick={() => removePost(post)}
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-red-600 hover:bg-red-100 focus-visible:ring-2"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-sm text-slate-600">Local-only demo. Never use real passwords or sensitive data; credentials are plaintext.</p>
    </main>
  );
}
