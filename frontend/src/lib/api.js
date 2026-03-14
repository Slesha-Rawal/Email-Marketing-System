import axios from "axios";
import { AUTH_STORAGE_KEY } from "./authStorage.js";

const api = axios.create({
  baseURL: "http://localhost:3001/api",
});

api.interceptors.request.use((config) => {
  try {
    const storedValue = localStorage.getItem(AUTH_STORAGE_KEY);

    if (storedValue) {
      const { user } = JSON.parse(storedValue);

      if (user?.userId) {
        config.headers["x-user-id"] = String(user.userId);
      }
    }
  } catch (error) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  return config;
});

export default api;
