/** Provide accessible plain-text publishing and ownership-checked editing. */
import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { getSession } from '../utils/auth.js';
import { canManagePost, createPost, getPost, updatePost, validatePost } from '../utils/posts.js';

/** Prefill editable text and navigate only after successful persistence.
 * Notes: The route supplies a key so changing post identity resets the draft.
 */
export default function WriteBlog() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post] = useState(() => getPost(id));
  const [title, setTitle] = useState(post?.title || '');
  const [content, setContent] = useState(post?.content || '');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const session = getSession();

  /** Validate fields, then delegate live authorization and persistence to mutations. */
  function save(event) {
    event.preventDefault();
    const fields = { title, content };
    const nextErrors = validatePost(fields);
    setErrors(nextErrors);
    setError('');
    if (Object.keys(nextErrors).length) return;
    try {
      const saved = id ? updatePost(id, fields) : createPost(fields);
      navigate(`/blog/${encodeURIComponent(saved.id)}`);
    } catch (cause) {
      setError(cause.message);
    }
  }

  if (!session) return <Navigate to="/login" replace />;
  if (id && post && !canManagePost(post, session)) return <Navigate to="/blogs" replace />;

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-12 text-slate-800">
      {id && !post ? (
        <section className="rounded-xl border border-slate-200 bg-white p-8">
          <h1 className="font-[Georgia] text-4xl font-bold">Post not found</h1>
          <Link to="/blogs" className="mt-6 inline-block rounded-lg px-4 py-2 text-indigo-700 focus-visible:ring-2">
            Back to All Posts
          </Link>
        </section>
      ) : (
        <>
          <h1 className="font-[Georgia] text-4xl font-bold">{id ? 'Edit post' : 'Write a post'}</h1>
          <p className="mt-3 text-slate-600">A title, your thoughts, and room to write. Plain text only.</p>
          <form onSubmit={save} noValidate className="mt-8 space-y-6 rounded-xl border border-slate-200 bg-white p-6 sm:p-10">
            <div>
              <label htmlFor="post-title" className="block font-medium">Title</label>
              <input
                id="post-title"
                name="title"
                required
                aria-required="true"
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? 'title-error' : undefined}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.title && (
                <p id="title-error" role="alert" className="mt-2 text-sm text-red-700">{errors.title}</p>
              )}
            </div>
            <div>
              <label htmlFor="post-content" className="block font-medium">Content</label>
              <textarea
                id="post-content"
                name="content"
                required
                aria-required="true"
                aria-invalid={Boolean(errors.content)}
                aria-describedby={errors.content ? 'content-error content-counter' : 'content-counter'}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="mt-2 min-h-64 w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.content && (
                <p id="content-error" role="alert" className="mt-2 text-sm text-red-700">{errors.content}</p>
              )}
              <p id="content-counter" role="status" className="mt-2 text-right text-sm tabular-nums text-slate-600">
                {content.length} characters
              </p>
            </div>
            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:ring-2"
              >
                {id ? 'Save' : 'Publish'}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="rounded-lg px-4 py-3 font-medium text-slate-600 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </>
      )}
    </main>
  );
}
