import React, { createContext, useState, useContext, useEffect } from "react";
import { AuthUser, AuthContextType, UserStatus } from "../types";
import api from "../utils/api";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const fetchUser = async (authToken: string) => {
      try {
        const response = await api.get("/api/user", {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (response.data) {
          setUser(response.data);
          setIsAuthenticated(true);
          localStorage.setItem("user", JSON.stringify(response.data));
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        logout();
      }
    };

    const storedToken = localStorage.getItem("token");
    // const storedUser = localStorage.getItem("user");

    if (storedToken) {
      setToken(storedToken);
      //   setUser(JSON.parse(storedUser));
      // setIsAuthenticated(true);
      fetchUser(storedToken);
    }
  }, []);

  const login = (userData: AuthUser, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);
    localStorage.setItem("token", authToken);
    localStorage.setItem("user", JSON.stringify(userData));

    console.log("Login successful:", { userData, authToken });
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout error", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
    }
  };

  const updateUser = (userData: Partial<AuthUser>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
  };

  const updateStatus = async (status: UserStatus) => {
    try {
      await api.post("/users/status", { status });
      if (user) {
        const updatedUser = { ...user, status };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error("Status update error:", error);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated,
    login,
    logout,
    updateUser,
    updateStatus,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
};

export default AuthContext;
