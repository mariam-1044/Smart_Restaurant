import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

// 1. إنشاء الـ Context
const AuthContext = createContext({
  user: null,
  login: async () => {},
  logout: () => {},
  register: async () => {},
  loading: false,
  isAuthenticated: false,
});

// 2. الـ Provider Component
export function AuthProvider({ children, initialUser = null }) {
  const [user, setUser] = useState(() => {
    if (initialUser) return initialUser;
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (initialUser) return true;
    return !!localStorage.getItem("token");
  });

  useEffect(() => {
    // Check if user is still authenticated on mount
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (token && savedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const saveUserSession = (userData, token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  };

  const login = async (credentials) => {
    setLoading(true);
    try {
      const res = await api.post("/auth/login", credentials);
      if (res.data.success) {
        saveUserSession(res.data.data.user, res.data.data.token);
        return res.data.data.user;
      }
    } catch (error) {
      console.error("Authentication failed:", error.response?.data?.message || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (registrationData) => {
    setLoading(true);
    try {
      const res = await api.post("/auth/register", registrationData);
      if (res.data.success) {
        return res.data.data;
      }
    } catch (error) {
      console.error("Registration failed:", error.response?.data?.message || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error.response?.data?.message || error.message);
    } finally {
      localStorage.clear();
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      register,
      loading, 
      isAuthenticated 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// 3. تصدير الـ Hook
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
