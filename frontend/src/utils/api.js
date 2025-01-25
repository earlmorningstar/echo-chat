import axios from "axios";
import { jwtDecode } from "jwt-decode";

const API_BASE_URL = process.env.REACT_APP_API_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      //remove potential params from token
      const cleanToken = token.split("?")[0];
      const decodedToken = jwtDecode(cleanToken);
      const currentTime = Date.now() / 1000;

      // If token is about to expire in next 5 minutes, attempt refresh
      if (decodedToken.exp < currentTime + 300) {
        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const response = await axios.post(
              `${API_BASE_URL}/api/auth/renew-token`,
              {},
              { headers: { Authorization: `Bearer ${cleanToken}` } }
            );

            const newToken = response.data.token;
            localStorage.setItem("token", newToken);

            processQueue(null, newToken);
            isRefreshing = false;
          } catch (refreshError) {
            processQueue(refreshError, null);
            isRefreshing = false;
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "/login";
            return Promise.reject(refreshError);
          }
        }

        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            config.headers.Authorization = `Bearer ${token}`;
            return config;
          })
          .catch((err) => Promise.reject(err));
      }

      config.headers.Authorization = `Bearer ${cleanToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const token = localStorage.getItem("token");
        const cleanToken = token.split("?")[0];
        const response = await axios.post(
          `${API_BASE_URL}/api/auth/renew-token`,
          {},
          { headers: { Authorization: `Bearer ${cleanToken}` } }
        );

        const newToken = response.data.token;
        localStorage.setItem("token", newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
