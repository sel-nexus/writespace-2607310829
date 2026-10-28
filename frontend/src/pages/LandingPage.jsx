/** Introduce the local journal using real publications and clear entry links. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { BlogCard } from '../components/BlogCard.jsx';
import { sortedPosts } from '../utils/posts.js';

const features = [
  ['Write Freely', 'Plain-text writing without distractions. Just you, your words, and room to think.'],
  ['Private & Local', 'Your data stays in this browser. A local-only demo, not a place for sensitive information.'],
  ['Instant & Fast', 'No server, no lag. Move from a passing thought to a published page in your own space.'],
];

/** Render public discovery; Start Reading follows the current session.
 * Args: session (object|null): Validated identity supplied by the application shell.
 */
export default function LandingPage({ session = null }) {
  const latest = sortedPosts().slice(0, 3);
  return (
    <>
      <main id="main-content" className="text-slate-800">
        <section className="flex min-h-[100dvh] items-center border-b border-slate-200 bg-slate-50">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-700">A journal, close to home</p>
              <h1 className="mt-6 break-words font-[Georgia] text-6xl font-bold tracking-tight sm:text-7xl">WriteSpace</h1>
              <p className="mt-6 max-w-lg font-[Georgia] text-3xl leading-snug">Your thoughts. Your space. Beautifully simple.</p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:ring-2"
                >
                  Get Started Free
                </Link>
                <Link
                  to={session ? '/blogs' : '/login'}
                  className="rounded-lg border border-indigo-200 bg-white px-5 py-3 font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:ring-2"
                >
                  Start Reading
                </Link>
              </div>
            </div>
            <aside
              className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6 motion-safe:animate-bounce motion-safe:[animation-duration:6s] sm:p-10"
              aria-label="Inside your journal"
            >
              <p className="mb-6 text-sm font-semibold text-indigo-700">Inside your journal</p>
              {latest.length ? (
                <div className="shadow-xl">
                  <BlogCard post={latest[0]} session={session} />
                </div>
              ) : (
                <div className="border-l-4 border-indigo-600 py-8 pl-6">
                  <span aria-hidden="true" className="block font-[Georgia] text-6xl text-indigo-600">
                    “
                  </span>
                  <p className="font-[Georgia] text-3xl leading-snug">Good stories start with a little room to think.</p>
                  <p className="mt-6 leading-7 text-slate-600">Your journal is waiting for its first words.</p>
                </div>
              )}
            </aside>
          </div>
        </section>
        <section aria-label="Features" className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {features.map(([title, description], index) => (
              <article key={title} className="rounded-xl border border-slate-200 bg-white p-8">
                <p aria-hidden="true" className="text-sm font-semibold text-indigo-700">0{index + 1}</p>
                <h2 className="mt-6 font-[Georgia] text-2xl font-bold">{title}</h2>
                <p className="mt-4 leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </section>
        <section aria-labelledby="latest-title" className="mx-auto max-w-6xl px-4 pb-24">
          <h2 id="latest-title" className="mt-3 font-[Georgia] text-4xl font-bold">Latest from the Blog</h2>
          {latest.length ? (
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {latest.map((post, index) => (
                <BlogCard key={post.id} post={post} index={index} session={session} />
              ))}
            </div>
          ) : (
            <p className="mt-8 border-t border-slate-200 py-8 text-slate-600">No posts yet — check back soon!</p>
          )}
        </section>
      </main>
      <footer className="bg-slate-900 px-4 py-12 text-slate-100">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-8">
          <div>
            <p className="font-[Georgia] text-2xl font-bold">WriteSpace</p>
            <p className="mt-3 text-sm text-slate-300">© {new Date().getFullYear()} WriteSpace</p>
          </div>
          <nav aria-label="Footer navigation" className="flex flex-wrap items-start gap-6">
            {['Home', 'All Blogs', 'Login', 'Register'].map((label, index) => (
              <Link
                key={label}
                to={['/', '/blogs', '/login', '/register'][index]}
                className="rounded py-2 text-sm hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}

LandingPage.propTypes = {
  session: PropTypes.shape({ userId: PropTypes.string, role: PropTypes.string }),
};
