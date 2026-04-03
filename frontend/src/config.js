import axios from 'axios';

const normalizeBaseUrl = (value, fallback) => {
  const baseUrl = value || fallback;
  return baseUrl.replace(/\/+$/, '');
};

const API_BASE_URL = normalizeBaseUrl(
  process.env.REACT_APP_API_URL,
  'http://localhost:5000'
);

const PUBLIC_BASE_URL = normalizeBaseUrl(
  process.env.REACT_APP_PUBLIC_BASE_URL,
  API_BASE_URL
);

export const apiUrl = (path) => `${API_BASE_URL}${path}`;
export const publicShortUrl = (shortCode) => `${PUBLIC_BASE_URL}/${shortCode}`;
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});
