import axios from "axios";
import { AUTH_STORAGE_KEY } from "./authStorage.js";

const api = axios.create({
  baseURL: "http://localhost:3001/api",
});

api.interceptors.request.use((config) => {
  try {
    const storedValue = localStorage.getItem(AUTH_STORAGE_KEY);

    if (storedValue) {
      const storedAuth = JSON.parse(storedValue);
      const user = storedAuth?.user ?? null;
      const userId = user?.userId ?? storedAuth?.userId;
      const token = storedAuth?.token ?? user?.token;

      if (userId) {
        config.headers["x-user-id"] = String(userId);
      }
      if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }
    }
  } catch (error) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  return config;
});

export default api;
