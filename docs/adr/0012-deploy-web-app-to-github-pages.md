# 0012. Deploy the web app to GitHub Pages

Date: 2026-10-19
Status: Accepted

## Context

The web app is a static bundle with no backend of its own: music comes from Audius, whose API and
content nodes accept requests from any origin, and all user data lives in the browser. We need a
public URL for testers now, with no new accounts, secrets or monthly cost, and the code already
lives on GitHub with CI.

## Decision

- Deploy from `main` to GitHub Pages with a workflow: build, upload the `dist` folder, publish.
  Every push to `main` that passes is live within a couple of minutes.
- The site is served under the repository subpath, so the build sets Vite's `base`, the router
  takes the same base, the manifest and icons use relative URLs, and `index.html` is copied to
  `404.html` so deep links into the single-page app load on refresh.
- No service worker yet (roadmap M2), so the app needs the network on first load; it degrades to
  cached library data when the music service is unreachable.

## Consequences

- Zero cost, zero infrastructure, HTTPS by default, and the deploy history is the commit history.
- A subpath URL is less memorable than a domain. A custom domain can be attached to Pages later
  without changing the build, only the base.
- GitHub Pages is static hosting only. When the backend arrives (M3) the API lives elsewhere; the
  front end can stay here or move with it.

## Alternatives considered

- Vercel, Netlify or Cloudflare Pages: equally good for a static site, but each needs an account
  and a token we do not have in hand. Easy to switch to later.
- Self-hosting: needless for a static bundle.
