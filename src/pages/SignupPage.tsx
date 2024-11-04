import React, { useState, useEffect } from "react";
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
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Collapse from "@mui/material/Collapse";
import Stack from "@mui/material/Stack";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";
import "./Index.css";

const SignupPage: React.FC = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = React.useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessages, setErrorMessages] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
  };

  const showError = (field: keyof typeof errorMessages, message: string) => {
    setErrorMessages((prev) => ({ ...prev, [field]: message }));
    setTimeout(() => {
      setErrorMessages((prev) => ({ ...prev, [field]: "" }));
    }, 5000);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;

    if (!firstName) {
      showError("firstName", "Field cannot be blank");
      hasError = true;
    }
    if (!lastName) {
      showError("lastName", "Field cannot be blank");
      hasError = true;
    }
    if (!email) {
      showError("email", "Field cannot be blank");
      hasError = true;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      showError("email", "Email must be formatted correctly");
      hasError = true;
    }
    if (!password) {
      showError("password", "Field cannot be blank");
      hasError = true;
    } else if (password.length < 6 || !/[A-Z]/.test(password)) {
      showError(
        "password",
        "Password must be at least 6 characters and contain at least one uppercase letter"
      );
      hasError = true;
    } else if (password === "Password") {
      showError("password", "Password cannot be 'Password'");
      hasError = true;
    }
    if (password !== confirmPassword) {
      showError("confirmPassword", "Password does not match");
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);
    const response = await fetch("http://localhost:3000/api/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
      }),
    });

    setLoading(false);
    if (response.ok) {
      const userData = await response.json();
      console.log("Signup successful:", userData);
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 4000);
    } else {
      const errorData = await response.json();
      setError(errorData.message || "Error Signing Up. Please try again");
    }
  };

  return (
    <div className="auth-main-container">
      <NavLink to="/onboarding" className="login-redirection-arrow">
        <IoIosArrowRoundBack size={30} color="#000000" />
      </NavLink>
      <div className="auth-container">
        <h2>Sign up for EchoChat</h2>
        <p>Join us by creating your account below</p>

        <form onSubmit={handleSignup}>
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
                  User created successfully!!
                </Alert>
              </Collapse>
            </Box>
          )}
          {error && (
            <Stack sx={{ width: "35ch" }} spacing={2}>
              <Alert severity="error">{error}</Alert>
            </Stack>
          )}
          <span>
            <TextField
              type="text"
              label={
                <div className="auth-label-flex">
                  First Name <span style={{ color: "red" }}>*</span>
                </div>
              }
              variant="standard"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              sx={{
                m: 1,
                width: "35ch",
                ".MuiInputLabel-asterisk": { color: "#c2bfbf" },
              }}
            />
            {errorMessages.firstName && (
              <div className="error-message">{errorMessages.firstName}</div>
            )}
          </span>
          <span>
            <TextField
              type="text"
              label={
                <div className="auth-label-flex">
                  Last Name <span style={{ color: "red" }}>*</span>
                </div>
              }
              variant="standard"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              sx={{
                m: 1,
                width: "35ch",
                ".MuiInputLabel-asterisk": { color: "#c2bfbf" },
              }}
            />
            {errorMessages.lastName && (
              <div className="error-message">{errorMessages.lastName}</div>
            )}
          </span>

          <span>
            <TextField
              type="email"
              label={
                <div className="auth-label-flex">
                  Your Email <span style={{ color: "red" }}>*</span>
                </div>
              }
              variant="standard"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{
                m: 1,
                width: "35ch",
                ".MuiInputLabel-asterisk": { color: "#c2bfbf" },
              }}
            />
            {errorMessages.email && (
              <div className="error-message">{errorMessages.email}</div>
            )}
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
              <InputLabel
                id="pass-label-flex"
                htmlFor="standard-adornment-password"
              >
                Password <span style={{ color: "red" }}>*</span>
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
              />
            </FormControl>
            {errorMessages.password && (
              <div className="error-message">{errorMessages.password}</div>
            )}
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
              <InputLabel
                id="pass-label-flex"
                htmlFor="standard-adornment-confirm-password"
              >
                Confirm Password <span style={{ color: "red" }}>*</span>
              </InputLabel>
              <Input
                id="standard-adornment-confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              />
            </FormControl>
            {errorMessages.confirmPassword && (
              <div className="error-message">
                {errorMessages.confirmPassword}
              </div>
            )}
          </span>

          <button type="submit" className="auth-form-button">
            Sign Up
          </button>
        </form>
        <p>
          Already have an account?{" "}
          <NavLink to="/login" className="no-deco-signupLink">
            Sign In
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

export default SignupPage;
