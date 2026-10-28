/** Own the route table and refresh navigation after local session mutations. */
import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar.jsx';
import { PublicNavbar } from './components/PublicNavbar.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import Home from './pages/Home.jsx';
import ReadBlog from './pages/ReadBlog.jsx';
import WriteBlog from './pages/WriteBlog.jsx';
import { getSession } from './utils/auth.js';

/** Mount identity, reading and writing pages, preserving administration guards. */
export default function App() {
  const [session, setSessionState] = useState(getSession);
  const location = useLocation();

  /** Re-read the canonical session after forms or navigation mutate storage. */
  function onSessionChange() {
    setSessionState(getSession());
  }

  useEffect(() => {
    onSessionChange();
    window.addEventListener('storage', onSessionChange);
    return () => window.removeEventListener('storage', onSessionChange);
  }, [location.pathname]);

  const publicRoute = ['/', '/login', '/register'].includes(location.pathname);
  const shell = (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-16 text-slate-800">
      <h1 className="font-[Georgia] text-4xl font-bold">Your writing space</h1>
      <p className="mt-4 text-slate-600">Use the navigation to move around your local account.</p>
      <p className="mt-6 text-sm text-slate-600">
        Local-only demo. Passwords are plaintext; never use real credentials or sensitive data.
      </p>
      <Link to="/" className="mt-8 inline-block rounded-lg px-4 py-2 text-indigo-700 underline focus-visible:ring-2">
        Back to Home
      </Link>
    </main>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <a href="#main-content" className="sr-only rounded bg-white p-3 text-indigo-700 focus:not-sr-only focus:absolute focus:z-50">
        Skip to content
      </a>
      {session && !publicRoute ? (
        <Navbar session={session} onSessionChange={onSessionChange} />
      ) : (
        <PublicNavbar session={session} />
      )}
      <Routes>
        <Route path="/" element={<LandingPage session={session} />} />
        <Route path="/login" element={<LoginPage onSessionChange={onSessionChange} />} />
        <Route path="/register" element={<RegisterPage onSessionChange={onSessionChange} />} />
        <Route
          path="/blogs"
          element={(
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/blog/:id"
          element={(
            <ProtectedRoute>
              <ReadBlog />
            </ProtectedRoute>
          )}
        />
        {['/write', '/edit/:id'].map((path) => (
          <Route
            key={path}
            path={path}
            element={(
              <ProtectedRoute>
                <WriteBlog key={location.pathname} />
              </ProtectedRoute>
            )}
          />
        ))}
        {['/admin', '/users'].map((path) => (
          <Route
            key={path}
            path={path}
            element={(
              <ProtectedRoute adminOnly>
                {shell}
              </ProtectedRoute>
            )}
          />
        ))}
        <Route path="*" element={shell} />
      </Routes>
    </div>
  );
}
