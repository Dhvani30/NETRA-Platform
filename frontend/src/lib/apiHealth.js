import axios from 'axios';
import { API_URL } from '../config';

let healthProbe = null;

/** Accept only a successful JSON response from the FastAPI health endpoint. */
export function isApiResponse(response) {
  const contentType = response?.headers?.['content-type'] || '';
  return response?.status >= 200
    && response.status < 300
    && /application\/(?:[a-z0-9.+-]+\+)?json/i.test(contentType)
    && response.data !== null
    && typeof response.data === 'object'
    && !Array.isArray(response.data);
}

/** One shared check of /api/v1/health/sources. Network failures stay quiet. */
export function pingBackend() {
  if (!healthProbe) {
    healthProbe = axios.get(`${API_URL}/health/sources`, { timeout: 4000, validateStatus: () => true })
      .then(isApiResponse)
      .catch(() => false)
      .finally(() => { healthProbe = null; });
  }
  return healthProbe;
}