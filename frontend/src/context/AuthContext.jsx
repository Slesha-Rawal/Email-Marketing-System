import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api.js";
import { AUTH_STORAGE_KEY } from "../lib/authStorage.js";

const AuthContext = createContext(null);

const readStoredAuth = () => {
  try {
    const storedValue = localStorage.getItem(AUTH_STORAGE_KEY);
    const parsed = storedValue ? JSON.parse(storedValue) : { user: null };
    const user = parsed?.user ?? null;
    const token = parsed?.token ?? user?.token ?? null;

    if (!user?.userId) {
      return { user: null, token: null };
    }

    return { user, token: token || null };
  } catch (error) {
    return { user: null, token: null };
  }
};

const persistAuth = (authState) => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState));
};

const isSessionInvalidError = (error) => {
  const status = Number(error?.response?.status || 0);
  return status === 401 || status === 403;
};

function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(readStoredAuth);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const response = await api.post(
          "/auth/refresh",
          {},
          {
            meta: {
              skipSuccessToast: true,
              skipErrorToast: true,
              skipAuthRefresh: true,
            },
          },
        );

        const refreshedToken = response?.data?.token ?? null;
        const refreshedUser = response?.data?.user ?? null;

        if (!refreshedToken || !refreshedUser?.userId) {
          throw new Error("Invalid refresh response");
        }

        const nextState = {
          user: refreshedUser,
          token: refreshedToken,
        };

        setAuthState(nextState);
        persistAuth(nextState);
      } catch (error) {
        if (isSessionInvalidError(error)) {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          setAuthState({ user: null, token: null });
        }
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    const handleAuthCleared = () => {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setAuthState({ user: null, token: null });
    };

    window.addEventListener("ems:auth-cleared", handleAuthCleared);

    return () => {
      window.removeEventListener("ems:auth-cleared", handleAuthCleared);
    };
  }, []);

  const login = (payload) => {
    setAuthState((previousState) => {
      const user = payload?.user ?? payload;
      const token =
        payload?.token ?? user?.token ?? previousState?.token ?? null;
      const nextState = { user, token };
      persistAuth(nextState);
      return nextState;
    });
  };

  const logout = async () => {
    try {
      await api.post(
        "/auth/logout",
        {},
        {
          meta: {
            skipSuccessToast: true,
            skipErrorToast: true,
            skipAuthRefresh: true,
          },
        },
      );
    } catch (error) {
      // Clear local auth state even if backend logout fails.
    } finally {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setAuthState({ user: null, token: null });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        token: authState.token ?? authState.user?.token ?? null,
        isAuthenticated: Boolean(authState.user?.userId && authState.token),
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
