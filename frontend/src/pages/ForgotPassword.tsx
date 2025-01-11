import React, { useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import {
  TextField,
  Alert,
  Snackbar,
  Backdrop,
  CircularProgress,
} from "@mui/material";
import api from "../utils/api";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const navigate = useNavigate();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post("/api/forgot-password", { email });
      setMessage(response.data.message);
      setShowSuccess(true);
      setTimeout(() => {
        navigate("/reset-password", { state: { email } });
      }, 2000);
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Error processing request";
      setError(message);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseError = (
    _event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") return;
    setShowError(false);
  };

  const handleCloseSuccess = (
    _event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") return;
    setShowSuccess(false);
  };

  return (
    <div className="forgot-password-container">
      <h2>Recover Your Password</h2>
      <form onSubmit={handleForgotPassword}>
        <Snackbar
          open={showError}
          autoHideDuration={3000}
          onClose={handleCloseError}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert severity="error" onClose={handleCloseError}>
            {error}
          </Alert>
        </Snackbar>

        <Snackbar
          open={showSuccess}
          autoHideDuration={3000}
          onClose={handleCloseSuccess}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert severity="success" onClose={handleCloseSuccess}>
            {message}
          </Alert>
        </Snackbar>

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
              ".MuiInputLabel-asterisk": { color: "#F9F4EC" },
            }}
            required
          />
        </span>
        <div>
          <button className="auth-form-button" type="submit">
            Send Reset Code
          </button>
        </div>
      </form>
      <p>
        Back to{" "}
        <NavLink to="/login" className="no-deco-signupLink">
          Sign in
        </NavLink>
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
