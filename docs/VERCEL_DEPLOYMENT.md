# Deploy the NETRA frontend to Vercel

This repository deploys the React/Vite dashboard to Vercel. The FastAPI API is a separate, stateful service: it uses MongoDB, Neo4j, background watchers, and optional ML packages, so it is not included in this Vercel deployment.

## Before deploying

1. Deploy `backend/` to a Python service that supports persistent connections and configure its MongoDB, Neo4j, and collector environment variables there.
2. In Vercel, import this repository with the repository root as the project root. The committed `vercel.json` installs and builds `frontend/` automatically.
3. Add `VITE_API_BASE` in Vercel Project Settings for every environment that will be deployed. Its value must be the public API URL including `/api/v1`, for example `https://api.example.com/api/v1`.
4. Configure the API's `CORS_ALLOWED_ORIGINS` with the Vercel production domain. For Vercel previews, optionally set `CORS_ALLOWED_ORIGIN_REGEX` to `https://.*\\.vercel\\.app` (or a narrower team-domain expression).

`VITE_API_BASE` is embedded in the browser bundle at build time. It is public configuration, not a location for secrets. Keep MongoDB, Neo4j, social-platform tokens, and all other credentials only on the API host.

## Deploy

Use the Vercel dashboard or run the following from the repository root after authenticating with the Vercel CLI:

```powershell
vercel
vercel --prod
```

Vercel runs `npm ci --prefix frontend` and `npm run build --prefix frontend`, then serves `frontend/dist`. The SPA fallback in `vercel.json` makes direct dashboard URLs resolve to the React app.

## Verify

After deployment, open the deployed URL, then use the application's API status indicator to confirm it can reach the configured API. If the dashboard reports the API as offline, verify the `VITE_API_BASE` value, that the API URL includes `/api/v1`, and that the API CORS allowlist includes the deployed frontend origin.
