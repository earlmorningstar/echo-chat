import React, { useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
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
// import { IoIosArrowRoundBack } from "react-icons/io";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";

import "./Index.css";

type FormField =
  | "firstName"
  | "lastName"
  | "email"
  | "password"
  | "confirmPassword";

interface ValidationRule {
  validate: (value: string, formData?: FormData) => boolean;
  message: string;
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const SignupPage: React.FC = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const validationRules: Record<FormField, ValidationRule[]> = {
    firstName: [
      {
        validate: (value) => !!value.trim(),
        message: "Please provide a first name",
      },
    ],
    lastName: [
      {
        validate: (value) => !!value.trim(),
        message: "Please provide a last name",
      },
    ],
    email: [
      {
        validate: (value) => !!value.trim(),
        message: "Please input your email address",
      },
      {
        validate: (value) => /\S+@\S+\.\S+/.test(value),
        message: "Email must be formatted correctly",
      },
    ],
    password: [
      {
        validate: (value) => !!value.trim(),
        message: "Password cannot be blank",
      },
      {
        validate: (value) =>
          value.length >= 6 && /[A-Z]/.test(value) && /\d/.test(value),
        message:
          "Password must be at least 6 characters and contain at least one uppercase letter and one number",
      },
      {
        validate: (value) => value !== "Password",
        message: "Password cannot be 'Password'",
      },
    ],
    confirmPassword: [
      {
        validate: (value, formData) => value === formData?.password,
        message: "Passwords do not match",
      },
    ],
  };

  const handleCloseError = (
    _event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") {
      return;
    }
    setShowError(false);
    setErrorMessages([]);
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

  const validateForm = (): boolean => {
    const formData: FormData = {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
    };

    const errors: string[] = [];

    Object.entries(validationRules).forEach(([field, rules]) => {
      for (const rule of rules) {
        if (!rule.validate(formData[field as FormField], formData)) {
          errors.push(rule.message);
          break;
        }
      }
    });

    if (errors.length > 0) {
      setErrorMessages(errors);
      setShowError(true);
      return false;
    }

    return true;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    try {
      const response = await api.post("/api/signup", {
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
      });

      const { user, token } = response.data;
      login(user, token);
      localStorage.setItem("verificationEmail", email);
      setSuccessMessage("Verify your email address to continue.");
      setShowSuccess(true);
      setTimeout(() => {
        navigate("/verify-code");
      }, 2000);
    } catch (error: any) {
      const message =
        error.response?.data?.message || "An error occurred. Please try again.";
      setErrorMessages([message]);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-main-container">
      {/* <NavLink to="/onboarding" className="login-redirection-arrow">
        <IoIosArrowRoundBack size={30} color="#000000" />
      </NavLink> */}
      <div className="auth-container">
        <h2>Sign up for EchoChat</h2>
        <p>Join us by creating your account below</p>

        <form onSubmit={handleSignup}>
          <Snackbar
            open={showError}
            autoHideDuration={5000}
            onClose={handleCloseError}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
          >
            <Alert severity="error" onClose={handleCloseError}>
              <div>
                {errorMessages.map((message, index) => (
                  <div key={index}>{message}</div>
                ))}
              </div>
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
                    onClick={() => setShowPassword(!showPassword)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              }
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
                    onClick={() => setShowPassword(!showPassword)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              }
            />
          </FormControl>

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
