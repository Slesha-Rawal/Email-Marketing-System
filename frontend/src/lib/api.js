import axios from "axios";
import { toast } from "react-toastify";
import { AUTH_STORAGE_KEY } from "./authStorage.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://34.207.179.4:3001/api",
  withCredentials: true,
});

const isAuthRoute = (url = "") => String(url || "").includes("/auth/");

const isRefreshRoute = (url = "") =>
  String(url || "").includes("/auth/refresh");

const isSessionInvalidError = (error) => {
  const status = Number(error?.response?.status || 0);
  return status === 401 || status === 403;
};

const clearStoredAuth = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ems:auth-cleared"));
  }
};

const persistStoredAuth = ({ user, token }) => {
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      user: user || null,
      token: token || null,
    }),
  );
};

const SUCCESS_METHODS = new Set(["post", "put", "patch", "delete"]);

const getRequestMethod = (config = {}) =>
  String(config.method || "get")
    .trim()
    .toLowerCase();

const getRequestUrl = (config = {}) => String(config.url || "").trim();

const resolveSuccessMessage = (response, config = {}) => {
  const requestUrl = getRequestUrl(config);
  const requestMethod = getRequestMethod(config);

  if (
    requestMethod === "post" &&
    (requestUrl.includes("/auth/forgot-password/request-reset-link") ||
      requestUrl.includes("/auth/forgot-password/request-otp"))
  ) {
    return "Reset link sent to your email";
  }

  const responseMessage = String(response?.data?.message || "").trim();
  if (responseMessage) {
    return responseMessage;
  }

  if (requestMethod === "post" && requestUrl.includes("/auth/login")) {
    return "Login successful";
  }

  if (
    requestMethod === "post" &&
    requestUrl.includes("/auth/verify-login-otp")
  ) {
    return "Login successful";
  }

  if (
    requestMethod === "post" &&
    requestUrl.includes("/auth/forgot-password/reset")
  ) {
    return "Password reset successfully";
  }

  if (
    requestMethod === "post" &&
    requestUrl.includes("/auth/forgot-password/reset-with-token")
  ) {
    return "Password reset successfully";
  }

  if (requestMethod === "post") {
    return "Action completed successfully";
  }

  if (requestMethod === "put" || requestMethod === "patch") {
    return "Updated successfully";
  }

  if (requestMethod === "delete") {
    return "Deleted successfully";
  }

  return "Action completed successfully";
};

const resolveErrorMessage = (error) => {
  const apiMessage = String(error?.response?.data?.message || "").trim();
  if (apiMessage) {
    return apiMessage;
  }

  if (!error?.response) {
    return "Unable to reach server. Please try again.";
  }

  return "Request failed. Please try again.";
};

const shouldShowSuccessToast = (config = {}) => {
  if (config?.meta?.skipSuccessToast) {
    return false;
  }

  return SUCCESS_METHODS.has(getRequestMethod(config));
};

const shouldShowErrorToast = (error) => {
  const config = error?.config || {};

  if (config?.meta?.skipErrorToast) {
    return false;
  }

  const requestUrl = getRequestUrl(config);

  // Silent background session-check failures during bootstrap.
  if (requestUrl.includes("/auth/me")) {
    return false;
  }

  return true;
};

api.interceptors.request.use((config) => {
  try {
    const storedValue = localStorage.getItem(AUTH_STORAGE_KEY);

    if (storedValue) {
      const storedAuth = JSON.parse(storedValue);
      const user = storedAuth?.user ?? null;
      const token = storedAuth?.token ?? user?.token;
      if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }
    }
  } catch (error) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  return config;
});

let refreshRequest = null;

const refreshAccessToken = async () => {
  if (!refreshRequest) {
    refreshRequest = api
      .post(
        "/auth/refresh",
        {},
        {
          meta: {
            skipSuccessToast: true,
            skipErrorToast: true,
            skipAuthRefresh: true,
          },
        },
      )
      .then((response) => {
        const token = response?.data?.token ?? null;
        const user = response?.data?.user ?? null;

        if (!token || !user?.userId) {
          throw new Error("Invalid refresh response");
        }

        persistStoredAuth({ user, token });
        return { token, user };
      })
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
};

api.interceptors.response.use(
  (response) => {
    if (shouldShowSuccessToast(response.config)) {
      toast.success(resolveSuccessMessage(response, response.config));
    }

    return response;
  },
  (error) => {
    const originalRequest = error?.config || {};
    const responseStatus = Number(error?.response?.status || 0);
    const requestUrl = getRequestUrl(originalRequest);
    const isRetriable401 =
      responseStatus === 401 &&
      !originalRequest?._retry &&
      !originalRequest?.meta?.skipAuthRefresh &&
      !isRefreshRoute(requestUrl) &&
      !isAuthRoute(requestUrl);

    if (isRetriable401) {
      originalRequest._retry = true;

      return refreshAccessToken()
        .then(({ token }) => {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((refreshError) => {
          if (isSessionInvalidError(refreshError)) {
            clearStoredAuth();
          }
          return Promise.reject(refreshError);
        });
    }

    if (isRefreshRoute(requestUrl) && isSessionInvalidError(error)) {
      clearStoredAuth();
    }

    if (shouldShowErrorToast(error)) {
      toast.error(resolveErrorMessage(error));
    }

    return Promise.reject(error);
  },
);

export default api;
