// This safely handles the API URL for both local dev and production
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';