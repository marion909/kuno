const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost';

export const config = {
  apiUrl: API_BASE_URL,
  wsUrl: API_BASE_URL.replace('http', 'ws'),
};
