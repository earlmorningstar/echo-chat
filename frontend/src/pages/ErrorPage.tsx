import { NavLink } from "react-router-dom";
import { IoIosArrowRoundBack } from "react-icons/io";

const ErrorPage: React.FC = () => {
  return (
    <div className="auth-main-container">
      <div className="error-page-container">
        <NavLink
          className="login-redirection-arrow"
          to="/main-navigation/chats"
        >
          <IoIosArrowRoundBack size={30} color="var(--text-primary)" />{" "}
        </NavLink>
        <span>
          <h2>Oh, no! Something just went wrong.</h2>
          <p>An unexpected error occurred. Please go back and try again</p>
        </span>
      </div>
    </div>
  );
};

export default ErrorPage;
