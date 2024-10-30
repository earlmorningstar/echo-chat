
import React from "react";
import { NavLink } from "react-router-dom";
import "./Index.css";

const OnboardingScreen: React.FC = () => {
  return (
    <div className="onboarding-container">
      <h2>Welcome to EchoChat</h2>
      <h1>Connect with friends easily & quickly</h1>
      <h4>
        EchoChat is the perfect way to stay connected with friends and family.
      </h4>
      <p>Please choose an option to continue:</p>
      <div className="onboarding-buttons-container">
        <NavLink to="/login" className="onboarding-buttons">
          <button>Log In</button>
        </NavLink>
        <NavLink to="/signup" className="onboarding-buttons">
          <button>Sign Up</button>
        </NavLink>
      </div>
    </div>
  );
};

export default OnboardingScreen;
