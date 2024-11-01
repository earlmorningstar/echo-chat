import React, { useState } from "react";
import { TextField } from "@mui/material";
import { NavLink } from "react-router-dom";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
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
    </div>
  );
};

export default ForgotPassword;
