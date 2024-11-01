import { NavLink } from "react-router-dom";
import { IoIosArrowRoundBack } from "react-icons/io";

const ErrorPage: React.FC = () => {
  return (
    <div className="error-page-container">
      <NavLink className="login-redirection-arrow" to="/onboarding">
        <IoIosArrowRoundBack size={30} color="#000000" />
      </NavLink>
      <span>
        <h2>Oh, no! Something just went wrong.</h2>
        <p>An unexpected error occurred. Please go back and try again</p>
      </span>
    </div>
  );
};

export default ErrorPage;
