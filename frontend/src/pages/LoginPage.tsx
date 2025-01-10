import React, { useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
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
import { IoIosArrowRoundBack } from "react-icons/io";
import api from "../utils/api";

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.post("/api/login", { email, password });
      const { user, token } = response.data;

      login(user, token);
      setSuccessMessage("Login successful!");
      setLoading(false);
      setEmail("");
      setPassword("");
      setShowSuccess(true);

      setTimeout(() => {
        navigate("/main-navigation/chats");
      }, 2000);
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        "Login failed. Please check your credentials.";
      setError(message);
      setShowError(true);
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
    <div className="auth-main-container">
      <NavLink to="/onboarding" className="login-redirection-arrow">
        <IoIosArrowRoundBack size={30} color="#000000" />
      </NavLink>
      <div className="auth-container">
        <h2>Log in to EchoChat</h2>
        <p>
          Welcome back! Login using your registered email to continue with us
        </p>

        <form onSubmit={handleLogin}>
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
              type="email"
              label="Your Email"
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

          <span>
            <FormControl
              sx={{
                m: 1,
                width: "35ch",
                ".MuiInputLabel-asterisk": { color: "#c2bfbf" },
              }}
              variant="standard"
            >
              <InputLabel htmlFor="standard-adornment-password">
                Password
              </InputLabel>
              <Input
                id="standard-adornment-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={
                        showPassword
                          ? "hide the password"
                          : "display the password"
                      }
                      onClick={handleClickShowPassword}
                      onMouseDown={handleMouseDownPassword}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                }
                required
              />
            </FormControl>
          </span>

          <button type="submit" className="auth-form-button">
            Sign In
          </button>
        </form>
        <p>
          <NavLink
            to="/forgot-password"
            id="no-deco-id"
            className="no-deco-signupLink"
          >
            Recover Password
          </NavLink>
        </p>
        <p>
          Don't have an account?{" "}
          <NavLink to="/signup" className="no-deco-signupLink">
            Sign Up
          </NavLink>
        </p>
      </div>
      <Backdrop
        sx={{ color: "#208d7f", zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={loading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </div>
  );
};

export default LoginPage;
