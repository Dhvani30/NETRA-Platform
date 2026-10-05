import axios from 'axios';
import { API_URL } from '../config';

let healthProbe = null;

/** One shared check of /api/v1/health/sources. Network failures stay quiet. */
export function pingBackend() {
  if (!healthProbe) {
    healthProbe = axios.get(`${API_URL}/health/sources`, { timeout: 4000, validateStatus: () => true })
      .then(response => response.status > 0 && response.status < 500)
      .catch(() => false)
      .finally(() => { healthProbe = null; });
  }
  return healthProbe;
}
