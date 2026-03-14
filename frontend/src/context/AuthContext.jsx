import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api.js";
import { AUTH_STORAGE_KEY } from "../lib/authStorage.js";

const AuthContext = createContext(null);

const readStoredAuth = () => {
  try {
    const storedValue = localStorage.getItem(AUTH_STORAGE_KEY);
    return storedValue ? JSON.parse(storedValue) : { user: null };
  } catch (error) {
    return { user: null };
  }
};

const persistAuth = (authState) => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));
};

function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(readStoredAuth);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      if (!authState.user?.userId) {
        setIsBootstrapping(false);
        return;
      }

      try {
        const response = await api.get("/auth/me");
        const nextState = {
          user: response.data.user,
        };
        setAuthState(nextState);
        persistAuth(nextState);
      } catch (error) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setAuthState({ user: null });
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrap();
  }, []);

  const login = (user) => {
    const nextState = { user };
    setAuthState(nextState);
    persistAuth(nextState);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setAuthState({ user: null });
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        isAuthenticated: Boolean(authState.user?.userId),
        isBootstrapping,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

const useAuth = () => useContext(AuthContext);

export { AuthProvider, useAuth, AUTH_STORAGE_KEY };
