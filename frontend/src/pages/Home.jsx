/** Show the shared browser-local collection to authenticated readers. */
import { Link } from 'react-router-dom';
import { BlogCard } from '../components/BlogCard.jsx';
import { sortedPosts } from '../utils/posts.js';

/** Render newest-first publications or an actionable empty state. */
export default function Home() {
  const posts = sortedPosts();
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-12 text-slate-800">
      <p className="text-xs font-semibold uppercase tracking-widest text-indigo-700">The local journal</p>
      <h1 className="mt-3 font-[Georgia] text-4xl font-bold sm:text-5xl">All Blogs</h1>
      <p className="mt-4 text-slate-600">Fresh thoughts, shared in your own space. Newest stories first.</p>
      {posts.length ? (
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => (
            <BlogCard key={post.id} post={post} index={index} />
          ))}
        </div>
      ) : (
        <section className="mt-10 rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
          <h2 className="font-[Georgia] text-2xl font-bold">No blogs yet. Be the first to write one!</h2>
          <p className="mt-4 text-slate-600">A small thought can be the start of something worth reading.</p>
          <Link
            to="/write"
            className="mt-8 inline-block rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 focus-visible:ring-2"
          >
            Write
          </Link>
        </section>
      )}
    </main>
  );
}
