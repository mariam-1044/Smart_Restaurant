import axios from "axios";

// Dev: Vite serves Client/.env -> VITE_API_URL=http://localhost:8080/api.
// Containerized/prod build: no VITE_API_URL, so fall back to a relative path —
// the nginx container proxies /api to the API service, so the app works on
// any host/IP without rebuilding.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api"
});

// Request interceptor to add the token to headers
api.interceptors.request.use(req => {
  const token = localStorage.getItem("token");
  if (token) req.headers.Authorization = `Bearer ${token}`;
  return req;
});

// Response interceptor to handle token expiration and invalid tokens
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;
    
    // Check for 401 Unauthorized errors which indicate token issues
    if (response && response.status === 401) {
      const errorType = response.data?.errorType;
      
      // If it's a token-related error, clear local storage and redirect to login
      if (['TOKEN_EXPIRED', 'INVALID_TOKEN', 'SESSION_EXPIRED', 'USER_NOT_FOUND'].includes(errorType)) {
        console.warn("Session expired or invalid token. Redirecting to login...");
        localStorage.clear();
        
        // Only redirect if we're not already on the login or register page
        if (!window.location.pathname.includes('/') && !window.location.pathname.includes('/register')) {
          window.location.href = '/';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
