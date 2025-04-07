import React, { createContext, useState, useContext, useEffect } from "react";
import { AuthUser, AuthContextType, UserStatus } from "../types";
import api from "../utils/api";
import EchoChatLoader from "../pages/EchoChatLoader";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async (authToken: string) => {
      try {
        const response = await api.get("/profile", {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (response.data?.user?._id) {
          const userData: AuthUser = {
            _id: response.data.user._id,
            firstName: response.data.user.firstName,
            lastName: response.data.user.lastName,
            email: response.data.user.email,
            username: response.data.user.username,
            avatarUrl: response.data.user.avatarUrl,
            status: response.data.user.status,
            lastSeen: response.data.user.lastSeen,
          };
          setUser(userData);
          setIsAuthenticated(true);
          localStorage.setItem("user", JSON.stringify(userData));
        } else {
          throw new Error("User data missing _id field");
        }
      } catch (error: any) {
        console.error("Error fetching user:");
        await logout();
      } finally {
        setIsLoading(false);
      }
    };

    const initializeAuth = async () => {
      const storedToken = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");

      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      setToken(storedToken);

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);

          if (parsedUser._id) {
            setUser({
              ...parsedUser,
              avatarUrl: parsedUser.avatarUrl,
            });
            setIsAuthenticated(true);
            setIsLoading(false);
          } else {
            await fetchUser(storedToken);
          }
        } catch (error) {
          console.error("Error parsing stored user:");
          await fetchUser(storedToken);
        }
      } else {
        await fetchUser(storedToken);
      }
    };
    initializeAuth();
  }, []);

  useEffect(() => {
    const loadingTimeout = setTimeout(() => {
      if (isLoading) {
        console.error("loading timeout reached");
        setIsLoading(false);
        logout();
      }
    }, 10000);
    return () => clearTimeout(loadingTimeout);
  }, [isLoading]);

  const login = (userData: AuthUser, authToken: string) => {
    if (!userData?._id || !authToken) {
      return;
    }
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);
    localStorage.setItem("token", authToken);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = async () => {
    try {
      await api.post("/api/logout");
    } catch (error) {
      console.error("Logout error", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      window.location.href = "/login";
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
      await api.post("api/user/status", { status });
      if (user) {
        const updatedUser = { ...user, status };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error("Status update error:");
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    updateUser,
    updateStatus,
  };

  if (isLoading) {
    return <EchoChatLoader />
    //work on this loader soonest.
  }
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
