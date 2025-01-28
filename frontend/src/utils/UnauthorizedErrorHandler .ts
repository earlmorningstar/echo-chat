import React, { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

export const UnauthorizedErrorHandler: React.FC = () => {
  const { logout } = useAuth();

  useEffect(() => {
    const handleUnauthorizedError = (event: Event) => {
      const currentPath = window.location.pathname;

      const allowedPaths = [
        "/login",
        "/signup",
        "/onboarding",
        "/verify-code",
        "/forgot-password",
        "/reset-password",
      ];

      if (!allowedPaths.includes(currentPath)) {
        logout();
        window.location.href = "/login";
      }
    };

    window.addEventListener("unauthorized-error", handleUnauthorizedError);

    return () => {
      window.removeEventListener("unauthorized-error", handleUnauthorizedError);
    };
  }, [logout]);

  return null;
};
