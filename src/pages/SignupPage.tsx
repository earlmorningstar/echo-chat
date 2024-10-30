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
import "./Index.css";

const SignupPage: React.FC = () => {
  const [firstName, setFirstName] = useState("");
  const [lastname, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    // Placeholder logic for signing up
    console.log("Signing up with:", { email, password });
    // Navigate to the main app screen after signup
    navigate("/home");
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
          <span>
            <TextField
              type="text"
              label="First Name"
              variant="standard"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              sx={{ m: 1, width: "35ch" }}
            />
          </span>
          <span>
            <TextField
              type="text"
              label="Last Name"
              variant="standard"
              value={lastname}
              onChange={(e) => setLastName(e.target.value)}
              sx={{ m: 1, width: "35ch" }}
            />
          </span>

          <span>
            <TextField
              type="email"
              label="Your Email"
              variant="standard"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ m: 1, width: "35ch" }}
            />
          </span>

          <span>
            <FormControl sx={{ m: 1, width: "35ch" }} variant="standard">
              <InputLabel htmlFor="standard-adornment-password">
                Password
              </InputLabel>
              <Input
                id="standard-adornment-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
          </span>

          <span>
            <FormControl sx={{ m: 1, width: "35ch" }} variant="standard">
              <InputLabel htmlFor="standard-adornment-confirm-password">
                Confirm Password
              </InputLabel>
              <Input
                id="standard-adornment-confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
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
          </span>

          <button type="submit" className="auth-form-button">
            Sign Up
          </button>
        </form>
        <p>
          Already have an account?{" "}
          <NavLink to="/login" className="no-deco-signupLink">
            Log In
          </NavLink>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
