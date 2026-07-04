import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { db } from "../utils/db";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore Supabase session on mount
  useEffect(() => {
    db.getSession()
      .then(result => {
        if (result) {
          setUser(result.user);
          setToken(result.token);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);


  // Login
  const login = useCallback(async (email, password) => {
    const result = await db.login(email, password);

    setUser(result.user);
    setToken(result.token);

    return result;
  }, []);

  // Register
  const register = useCallback(async ({ name, email, password, phone, role }) => {
    const result = await db.register({
      name,
      email,
      password,
      phone,
      role,
    });

    setUser(null);
    setToken(null);

    return result;
  }, []);

  // Logout
  const logout = useCallback(async () => {
    await db.logout();

    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return ctx;
};