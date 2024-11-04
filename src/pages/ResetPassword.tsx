import React, { useState } from "react";
import { useParams, NavLink, useNavigate } from "react-router-dom";
import InputLabel from "@mui/material/InputLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Input from "@mui/material/Input";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import Backdrop from "@mui/material/Backdrop";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Collapse from "@mui/material/Collapse";

const ResetPassword: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = React.useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;
    if (!newPassword) {
      setErrorMessage("Password cannot be blank.");
      hasError = true;
    } else if (newPassword.length < 6 || !/[A-Z]/.test(newPassword)) {
      setErrorMessage(
        "Password must be at least 6 characters and contain at least one uppercase letter."
      );
      hasError = true;
    } else if (newPassword === "Password") {
      setErrorMessage("Password cannot be 'Password'.");
      hasError = true;
    } else if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      hasError = true;
    }
    if (hasError) {
      setTimeout(() => {
        setErrorMessage("");
      }, 4000);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:3000/api/reset-password/${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword }),
        }
      );
      setLoading(false);

      const data = await response.json();
      setMessage(data.message);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error) {
      setErrorMessage("Error resetting password.");
      setTimeout(() => {
        setErrorMessage("");
      }, 4000);
    }
  };

  return (
    <div className="forgot-password-container">
      <h2>Reset Password</h2>
      <form onSubmit={handleSubmit}>
        {message && (
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
                {message}
              </Alert>
            </Collapse>
          </Box>
        )}
        {errorMessage && (
          <Stack sx={{ width: "35ch" }} spacing={2}>
            <Alert severity="error">{errorMessage}</Alert>
          </Stack>
        )}
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
              htmlFor="standard-adornment-new-password"
            >
              New Password <span style={{ color: "red" }}>*</span>
            </InputLabel>
            <Input
              id="standard-adornment-confirm-password"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
              Confirm New Password <span style={{ color: "red" }}>*</span>
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
              required
            />
          </FormControl>
        </span>
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
