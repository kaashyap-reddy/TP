# Trainee Portal — Frontend

React 18 + TypeScript + Vite + React Router + Zustand + Tailwind. Talks to the Express API in `../backend` — see that project's README for the API side.

## Prerequisites

- Node.js 18+
- The backend running (see `../backend/README.md`) — the frontend has no functionality of its own without it.

## 1. Install dependencies

```bash
cd frontend
npm install
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_URL` | Base URL the app calls for every API request. Kept at `/api` for local dev — Vite's dev server proxies `/api/*` to `http://localhost:4000` (see `vite.config.ts`), so no CORS setup is needed locally. In production, point it at your deployed backend's origin, e.g. `https://trainee-portal-backend.up.railway.app/api`. | `/api` |
| `VITE_SOCKET_URL` | **Not implemented.** No WebSocket/Socket.io client exists in this codebase. Left as a documented placeholder only. | *(unused)* |

## 3. Run the dev server

```bash
npm run dev
```

Opens on `http://localhost:5173`.

## Production build

```bash
npm run build      # tsc -b && vite build → dist/
npm run preview    # serve the built dist/ locally to sanity-check before deploying
```

`npm run build` type-checks the whole project (`tsc -b`) before bundling, so a build failure always means a real type error, not just a bundler issue.

## Routing

Client-side routing via `react-router-dom`'s `BrowserRouter` (see `src/App.tsx`). Because routes like `/admin` or `/facilitator` don't correspond to real files on the host, **the deployment target must rewrite all paths to `index.html`** or refreshing/deep-linking into any non-root route will 404. This is already configured in `vercel.json` (`rewrites`); if you deploy elsewhere, replicate that SPA-fallback rule.

## Performance

- **Code-splitting**: every dashboard page (`AdminDashboardPage`, `FacilitatorDashboardPage`, `TraineeDashboardPage`, etc.) is lazy-loaded via `React.lazy()` in `App.tsx`, so the initial bundle only contains the login page's dependencies.
- **Compression**: Vite's production build is already minified with content-hashed filenames for long-term caching; gzip/brotli compression is applied at the edge by Vercel automatically — no build-time compression plugin needed.
- **Static asset caching**: `vercel.json` sets a 1-year immutable `Cache-Control` header on `/assets/*` (safe because Vite content-hashes those filenames — a new build gets new filenames, not new content at the old URL).

## Deployment

See the root [`DEPLOYMENT.md`](../DEPLOYMENT.md) for the full walkthrough. Short version: this is a static Vite build deployed to Vercel with the project root set to `frontend/`.

## Troubleshooting

- **Blank page after deploy, works locally**: almost always `VITE_API_URL` pointing at the wrong backend origin, or the backend's `CORS_ORIGIN` not including this frontend's deployed URL. Check the browser console/network tab for CORS or 404 errors.
- **404 on refresh at `/admin` or any non-root route**: the host isn't rewriting to `index.html` — see "Routing" above.
- **Logged in but immediately logged back out**: usually a cookie problem — the backend's refresh cookie needs `secure: true` (requires HTTPS, which Vercel/Railway/Render all provide) and the frontend and backend must both be served over HTTPS in production for `sameSite: 'none'` cookies to be accepted by the browser.
