export const API_URL = import.meta.env.VITE_API_BASE || '/api/v1';
export const API_UNREACHABLE = 'FastAPI is offline. Start it with `cd backend; python -m uvicorn main:app --reload --port 8000`; NETRA reconnects and refreshes automatically every 10 seconds.';
