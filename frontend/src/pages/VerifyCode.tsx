import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  TextField,
  Alert,
  Snackbar,
  Backdrop,
  CircularProgress,
} from "@mui/material";
import api from "../utils/api";

const VerifyCode: React.FC = () => {
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationEmail, setVerificationEmail] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const email = localStorage.getItem("verificationEmail");
    if (email) {
      setVerificationEmail(email);
    } else {
      navigate("/signup");
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post("/api/verify-email", {
        email: verificationEmail,
        code: verificationCode,
      });
      localStorage.removeItem("verificationEmail");
      setSuccessMessage("Email verification successful!. Now login.");
      setShowSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error: any) {
      const message = error.response?.data?.message || "Verification failed";
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
    if (reason === "clickaway") {
      return;
    }
    setShowSuccess(false);
  };

  return (
    <div className="forgot-password-container">
      <h2>Verify Your Email</h2>
      <p>Please enter the verification code sent to your email</p>

      <form onSubmit={handleSubmit}>
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
            {successMessage}
          </Alert>
        </Snackbar>

        <span>
          <TextField
            type="text"
            label="Verification Code"
            variant="standard"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            sx={{
              m: 1,
              width: "35ch",
              ".MuiInputLabel-asterisk": { color: "#c2bfbf" },
            }}
            required
          />
        </span>
        <div>
          <button className="auth-form-button" type="submit">
            Verify Email
          </button>
        </div>
      </form>

      <Backdrop
        sx={{ color: "#208d7f", zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={loading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </div>
  );
};

export default VerifyCode;
