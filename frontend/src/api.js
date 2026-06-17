// Centralized API configuration
// This allows switching between local development and production environments automatically.

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// If running locally, point to the local backend. Otherwise, use the production URL.
const API_URL = isLocal 
  ? 'http://localhost:8000' 
  : 'https://mentalwatch.up.railway.app';

export default API_URL;
