import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

export function createApiClient(getAccessToken) {
  const client = axios.create({ baseURL: API_URL });

  client.interceptors.request.use(async (config) => {
    const token = await getAccessToken({
      authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
    });
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  return client;
}
