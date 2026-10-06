const configuredApiBase = import.meta.env.VITE_API_BASE?.trim();
export const API_URL = configuredApiBase || '/api/v1';
export const API_UNREACHABLE = import.meta.env.PROD && !configuredApiBase
  ? 'Production API URL is not configured. Set VITE_API_BASE to the public FastAPI URL ending in /api/v1, then redeploy.'
  : 'FastAPI is offline. Start it with `cd backend; python -m uvicorn main:app --reload --port 8000`; NETRA reconnects and refreshes automatically every 10 seconds.';