/**
 * Authentication context for PlainPocket.
 * Manages user state, login/signup actions, and JWT persistence.
 */
import { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem("pp_token");
    const savedUser = localStorage.getItem("pp_user");

    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("pp_token");
        localStorage.removeItem("pp_user");
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { token, user: userData } = res.data;
    localStorage.setItem("pp_token", token);
    localStorage.setItem("pp_user", JSON.stringify(userData));
    setUser(userData);
    return res.data;
  };

  const signup = async (formData) => {
    const res = await authAPI.signup(formData);
    const { token, user: userData } = res.data;
    localStorage.setItem("pp_token", token);
    localStorage.setItem("pp_user", JSON.stringify(userData));
    setUser(userData);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("pp_token");
    localStorage.removeItem("pp_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
