# TMDB Proxy

A secure Cloudflare Worker proxy for [The Movie Database (TMDB) API](https://developers.themoviedb.org/3). Designed to be consumed by a local Electron app — the TMDB API key is injected server-side and never exposed to the client.

## Features

- **Hono framework** — light, fast, TypeScript-native routing
- **Cache-first** — uses the Cloudflare Cache API with a 1-hour TTL to reduce API usage and speed up popular endpoints
- **Header sanitisation** — strips sensitive inbound/outbound headers (`authorization`, `set-cookie`, `x-powered-by`, `server`, etc.)
- **Auth guard** — only requests carrying a shared `X-Proxy-Secret` header are allowed past `/health`
- **CORS** — open to all origins (your Electron app can call from any origin)

## Project structure

```
tmdb-proxy/
├── src/
│   └── index.ts              # Worker entry point
├── wrangler.jsonc            # Wrangler configuration
├── tsconfig.json             # TypeScript configuration
├── worker-configuration.d.ts # Auto-generated bindings types
├── package.json
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (included as a dev dependency)
- A [TMDB account](https://www.themoviedb.org/signup) and an API key
- A [Cloudflare account](https://dash.cloudflare.com/sign-up/workers)

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set secrets

These must be set before the worker will run. Secrets are stored encrypted by Cloudflare and injected as environment variables at runtime.

```bash
npx wrangler secret put TMDB_API_KEY
# Paste your TMDB API key (v3 auth) when prompted

npx wrangler secret put PROXY_SECRET
# Enter a shared secret your Electron app will use in the X-Proxy-Secret header
```

Alternatively, set them in the Cloudflare Dashboard under **Workers & Pages > tmdb-proxy > Settings > Variables > Secrets**.

### 3. Run locally

```bash
npm run dev
```

Wrangler will start a local dev server (usually at `http://localhost:8787`). To test from your Electron app during development, point it at `http://localhost:8787` and include the `X-Proxy-Secret` header.

### 4. Deploy

```bash
npm run deploy
```

This runs `wrangler deploy`, which uploads the worker to Cloudflare's global network. After deployment, you'll get a URL like `https://tmdb-proxy.<your-subdomain>.workers.dev`.

## Usage

From your Electron app, call the worker just like you would call TMDB directly, but use the worker URL instead:

```js
const TMDB_PROXY = 'https://tmdb-proxy.your-subdomain.workers.dev'

const res = await fetch(`${TMDB_PROXY}/3/movie/550`, {
  headers: { 'X-Proxy-Secret': '<your-secret>' },
})
const movie = await res.json()
```

The worker appends `?api_key=...` automatically — your key is **never** visible in the client's network tab or in your Electron app's source bundle.

### Endpoints

| Path | Description | Auth required |
|---|---|---|
| `/health` | Health check (returns `{ status: "ok" }`) | No |
| `/3/*` | Any TMDB API v3 endpoint | Yes (`X-Proxy-Secret`) |

## Caching behaviour

- Cache **lookup** happens on every request (GET only)
- Cache **write** happens via `c.executionCtx.waitUntil` — the client receives the response immediately, and the cache is populated in the background
- TTL is **1 hour** (`CACHE_TTL = 3600`)
- Cache keys are derived from the full request URL (with `api_key` stripped to avoid duplicates)

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run deploy` | Deploy to Cloudflare |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` |

## Security notes

- The `TMDB_API_KEY` is stored as a Cloudflare **secret** — it is encrypted at rest and never committed to version control
- The `PROXY_SECRET` should be a long, random string. Generate one with `openssl rand -hex 32`
- Inbound `authorization` header is stripped before forwarding to TMDB (the proxy uses `api_key` query param instead)
- Outbound `set-cookie`, `x-powered-by`, and `server` headers are removed from TMDB responses
