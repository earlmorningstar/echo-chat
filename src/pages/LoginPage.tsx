import React, { useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { IoIosArrowRoundBack } from "react-icons/io";
import TextField from "@mui/material/TextField";
import InputLabel from "@mui/material/InputLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Input from "@mui/material/Input";
import FormControl from "@mui/material/FormControl";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import IconButton from "@mui/material/IconButton";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";

import "./Index.css";

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = React.useState(true);
  const navigate = useNavigate();

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    const response = await fetch("http://localhost:3000/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      const userData = await response.json();
      console.log("Login successful:", userData);
      setSuccess(true);
      setTimeout(() => {
        navigate("/home");
      }, 2000);
    } else {
      const errorData = await response.json();
      setError(
        errorData.message || "Login failed. Please check your credentials."
      );
    }
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
          {success && (
            <Box sx={{ width: "35ch" }}>
              <Collapse in={open}>
                <Alert
                  action={
                    <IconButton
                      aria-label="close"
                      color="inherit"
                      size="small"
                      onClick={() => {
                        setOpen(false);
                      }}
                    ></IconButton>
                  }
                  sx={{ mb: 2 }}
                >
                  Login successful!
                </Alert>
              </Collapse>
            </Box>
          )}
          {error && (
            <Stack sx={{ width: "35ch" }} spacing={2}>
              <Alert severity="error">
                Error logging in. Please try again.
              </Alert>
            </Stack>
          )}
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
          Don’t have an account?{" "}
          <NavLink to="/signup" className="no-deco-signupLink">
            Sign Up
          </NavLink>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
