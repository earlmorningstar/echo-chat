import { NavLink, useLocation } from "react-router-dom";
import { PiPlusCircle } from "react-icons/pi";
import "./ChatAppStyles.css";

function Header() {
  const location = useLocation();

  const getTitle = () => {
    switch (location.pathname) {
      case "/main-navigation/chats":
        return "Chats";
      case "/main-navigation/calls":
        return "Calls";
      case "/main-navigation/updates":
        return "Updates";
      case "/main-navigation/settings":
        return "Settings";
      case "/main-navigation/user-profile":
        return "Profile";
      case "/main-navigation/add-user":
        return "Add a user";
      default:
        return "Chats";
    }
  };

  return (
    <header className="header">
      <div>
        <NavLink to="user-profile">
          <span>
            <img
              src="/images/user-profile-picture.jpeg"
              alt="Profile"
              className="profile-picture"
            />
          </span>
        </NavLink>
        <h2>{getTitle()}</h2>
      </div>

      <NavLink to="add-user">
        <PiPlusCircle size={24} color="#ffffff" />
      </NavLink>
    </header>
  );
}

export default Header;
