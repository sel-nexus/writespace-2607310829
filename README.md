# WriteSpace

A browser-local blog demo built with React 18, Vite 5, JavaScript/JSX, React Router 6 and Tailwind CSS 3. Guests discover recent writing; members register, read and manage their own posts; admins manage all posts and eligible accounts.

## Important limitations

**Never use real passwords or sensitive data.** Passwords are plaintext in localStorage, and all authorization runs in the browser. Anyone with browser developer tools can modify records or permissions. This is not production authentication, secure publishing, or a synchronized community. Each browser/origin has a separate collection. Clearing browser storage deletes that collection. There is no backend, API, database, encryption, or cloud synchronization.

Demo login: username `admin`, password `admin`. The permanent default administrator cannot be removed. Accounts and posts initially start empty otherwise.

## Run locally

Use Node 22.14+ or Node 24 and npm.

```sh
cd frontend
npm ci --no-bin-links
cp .env.example .env
npm run dev
```

The local development URL is controlled by `DEV_HOST` and `DEV_PORT` in `.env` (defaults 127.0.0.1:5173). There are no secret environment values. The build is a standalone bundle, not a server.

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

## Tests

```sh
cd frontend
npm test
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e
```

Playwright starts its own Vite server on `E2E_BASE_URL`; do not occupy that port with a separate server. Tests run serially in desktop Chromium and Pixel 7 Chromium contexts, with console/uncaught-error assertions. Tests use isolated localStorage, real UI navigation and persisted-record assertions. Screenshots and accessibility/HTML/computed-style evidence are written under `frontend/test-results/` when evidence-bearing journeys run. `npm test` selects source unit/component tests, not browser specs.

Verified during Development: four feature suites (latest counts identity 97, reading 77, writing 54, administration 41); all 58 browser cases passed across the final affected-spec runs. The read-only test critic passed round 2 with score 1.00 and zero high failures. The production Vite build exited 0. See the separately published test report for run history; it is intentionally excluded from Git.

## Routes and records

Public: `/`, `/login`, `/register`. Members: `/blogs`, `/blog/:id`, `/write`, `/edit/:id`. Admin-only: `/admin`, `/users`. Guests are sent to Login; ordinary members are redirected away from administration. Mutations independently check the current local session and ownership, not just hidden controls.

Storage keys: `writespace_posts`, `writespace_users`, `writespace_session`. Post IDs use `crypto.randomUUID()`, dates are ISO timestamps, and readers preserve plain-text whitespace. Display reads degrade gracefully when storage is unavailable/corrupt; mutation reads refuse to replace unreadable collections. Failed writes retain forms and show errors. Registration writes account then session separately: if session save fails after account save, recover through Login.

Dashboard labels follow the supplied PRD: Total Posts; Total Users (all accounts including default admin); Total Admins; Total users (ordinary members). Admin-created admin accounts can be removed unless currently signed in; the permanent admin and current account are protected. Deleting accounts retains their authored posts.

## Deploy as static files

### Vercel

Import the repository and set **Root Directory to `frontend`**, framework Vite, build `npm run build`, output `dist`. `frontend/vercel.json` contains only the required SPA rewrite to `/index.html`. The identical root copy is provided for discoverability; using repository root as the Vercel project root without configuring the nested build is not supported. Direct routes require the rewrite.

### nginx / Docker

`frontend/Dockerfile` builds assets and serves them with nginx on port 80. `frontend/nginx.conf` supplies the SPA history fallback and no backend proxy. Example:

```sh
docker build -t writespace-demo frontend
docker run --rm -p 8080:80 writespace-demo
```

The Docker image build and live Vercel deployment were not executed in this Development run. The source production build and live Vite browser workflows were verified.

## Dependency review

Dependencies are pinned with a lockfile. Compatible security patches were applied to Router, Vite, PostCSS, Vitest and Playwright. The final audit still reports four affected packages (three moderate, one high): two Router 6 runtime packages and Vite/esbuild development tooling. Fully clearing them requires major Router/Vite changes beyond the supplied stack. Do not expose the development/test servers publicly; deploy only compiled static files. There is no SSR hydration or user-controlled navigation target in this app, but the runtime audit findings are retained rather than declared fixed. Vitest also emits React-plugin esbuild/oxc deprecation warnings; tests pass.
