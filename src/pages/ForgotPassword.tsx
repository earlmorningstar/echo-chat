import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { TextField } from "@mui/material";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      setLoading(true);
      const response = await fetch(
        "http://localhost:3000/api/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );
      setLoading(false);

      if (response.ok) {
        setMessage("A password reset link has been sent to your email.");
      } else {
        const errorData = await response.json();
        setError(errorData.message || "Error sending password reset link.");
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      setError("Failed to send password reset request. Please try again.");
    }
  };

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className="forgot-password-container">
      <h2>Recover Your Password</h2>
      <form onSubmit={handleForgotPassword}>
        <span>
          <TextField
            type="email"
            label="Your Email Address"
            variant="standard"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{
              m: 1,
              width: "35ch",
              ".MuiInputLabel-asterisk": { color: "#c2bfbf" },
            }}
            required
          />
        </span>
        <div>
          <button
            className="auth-form-button"
            id="forgotPassBtnId"
            type="submit"
          >
            Send Reset Link
          </button>
        </div>
      </form>
      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}
      <p>
        Back to
        <NavLink to="/login" className="no-deco-signupLink">
          Sign in
        </NavLink>
        Page
      </p>
      <Backdrop
        sx={{ color: "#208d7f", zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={loading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </div>
  );
};

export default ForgotPassword;
