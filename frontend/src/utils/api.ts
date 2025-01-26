import axios from "axios";
import { jwtDecode } from "jwt-decode";

const API_BASE_URL = process.env.REACT_APP_API_URL;

class TokenManager {
  private static instance: TokenManager;
  private isRefreshing = false;
  private failedQueue: {
    resolve: (token: string) => void;
    reject: (error: any) => void;
  }[] = [];

  private constructor() {}

  public static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  private processQueue(error: any, token: string | null) {
    this.failedQueue.forEach((prom) => {
      if (error) {
        prom.reject(error);
      } else if (token) {
        prom.resolve(token);
      }
    });
    this.failedQueue = [];
  }

  public async refreshToken(currentToken: string): Promise<string> {
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.failedQueue.push({ resolve, reject });
      });
    }
    this.isRefreshing = true;

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/renew-token`,
        {},
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
            "Content-Type": "application/json",
          },
          withCredentials: true,
        }
      );

      const newToken = response.data.token;
      localStorage.setItem("token", newToken);

      this.processQueue(null, newToken);
      this.isRefreshing = false;

      return newToken;
    } catch (error) {
      this.processQueue(error, null);
      this.isRefreshing = false;

      this.handleAuthError();
      throw error;
    }
  }

  private handleAuthError() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.dispatchEvent(new CustomEvent("unauthorized-error"));
  }

  public isTokenExpired(token: string): boolean {
    try {
      const decodedToken = jwtDecode<{ exp?: number }>(token);
      const currentTime = Date.now() / 1000;
      return decodedToken.exp ? decodedToken.exp < currentTime + 600 : true;
    } catch {
      return true;
    }
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

const tokenManager = TokenManager.getInstance();

api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem("token");
  if (token) {
    if (tokenManager.isTokenExpired(token)) {
      try {
        const newToken = await tokenManager.refreshToken(token);
        config.headers.Authorization = `Bearer ${newToken}`;
      } catch {
        window.dispatchEvent(new CustomEvent("unauthorized-error"));
        return Promise.reject(new Error("Token refresh failed"));
      }
    } else {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("No token");
        }

        const cleanToken = token.split("?")[0];
        const response = await axios.post(
          `${API_BASE_URL}/api/auth/renew-token`,
          {},
          {
            headers: {
              Authorization: `Bearer ${cleanToken}`,
              "Content-Type": "application/json",
            },
            withCredentials: true,
          }
        );

       const newToken = response.data.token;
        localStorage.setItem("token", newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        window.dispatchEvent(new CustomEvent("unauthorized-error"));
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);



export default api;