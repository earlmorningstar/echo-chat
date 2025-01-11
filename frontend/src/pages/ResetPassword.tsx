import React, { useState } from "react";
import { useNavigate, NavLink, useLocation } from "react-router-dom";
import {
  TextField,
  InputLabel,
  InputAdornment,
  Input,
  FormControl,
  IconButton,
  Alert,
  Snackbar,
  Backdrop,
  CircularProgress,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import api from "../utils/api";

const ResetPassword: React.FC = () => {
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  const validatePassword = (): boolean => {
    if(!newPassword) {
      setError("Password field cannot be blank");
      setShowError(true);
      return false;
    }
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);

    if(newPassword.length < 6 || !hasUpperCase || !hasNumber) {
      setError("Password must be at least 6 characters and contain at least one uppercase letter and one number");
      setShowError(true);
      return false;
    }

    if(newPassword.toLowerCase() === 'password'){
      setError("Password cannot be 'Password");
      setShowError(true);
      return false;
    }

    if(newPassword !== confirmPassword) {
      setError("Password do not match");
      setShowError(true);
      return false;
    }

    return true;
  }

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if(!validatePassword()){
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/reset-password", {
        email,
        code,
        newPassword,
      });
      setSuccessMessage("Password reset successful! Now login");
      setShowSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Error resetting password. Please try again";
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
      <h2>Reset Your Password</h2>
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
          autoHideDuration={5000}
          onClose={handleCloseSuccess}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
        >
          <Alert severity="success" onClose={handleCloseSuccess}>
            {successMessage}
          </Alert>
        </Snackbar>

        <TextField
          type="text"
          label="Reset Code"
          variant="standard"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          sx={{
            m: 1,
            width: "35ch",
            ".MuiInputLabel-asterisk": { color: "#F9F4EC" },
          }}
          required
        />

        <FormControl
          sx={{
            m: 1,
            width: "35ch",
            ".MuiInputLabel-asterisk": { color: "#F9F4EC" },
          }}
          variant="standard"
        >
          <InputLabel htmlFor="new-password">New Password</InputLabel>
          <Input
            id="new-password"
            type={showPassword ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            endAdornment={
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            }
            required
          />
        </FormControl>

        <FormControl
          sx={{
            m: 1,
            width: "35ch",
            ".MuiInputLabel-asterisk": { color: "#c2bfbf" },
          }}
          variant="standard"
        >
          <InputLabel htmlFor="confirm-password">Confirm Password</InputLabel>
          <Input
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            endAdornment={
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            }
            required
          />
        </FormControl>
        <div>
          <button className="auth-form-button" type="submit">
            Reset Password
          </button>
        </div>
      </form>
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

export default ResetPassword;
