import React, { useState } from "react";
import { useParams, NavLink } from "react-router-dom";
import InputLabel from "@mui/material/InputLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Input from "@mui/material/Input";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

const ResetPassword: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [showPassword, setShowPassword] = useState(false);

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:3000/api/reset-password/${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword }),
        }
      );

      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      setErrorMessage("Error resetting password.");
    }
  };

  return (
    <div className="forgot-password-container">
      <h2>Reset Password</h2>
      <form onSubmit={handleSubmit}>
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
      {message && <p className="success-message">{message}</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}
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

export default ResetPassword;
