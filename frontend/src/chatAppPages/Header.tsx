import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PiPlusCircle } from "react-icons/pi";
import UserAvatar from "../components/UserAvatar";
import "./ChatAppStyles.css";

const Header: React.FC = () => {
  const location = useLocation();
  const { user, 
    // updateUser 
  } = useAuth();

  const getTitle = () => {
    switch (location.pathname) {
      case "/main-navigation/chats":
        return "Chats";
      case "/main-navigation/calls":
        return "Calls";
      // case "/main-navigation/updates":
      //   return "Updates";
      case "/main-navigation/requests":
        return "Requests";
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
        <NavLink className="header-navlink" to="user-profile">
          <UserAvatar
            avatarUrl={user?.avatarUrl}
            firstName={user?.firstName || ""}
            lastName={user?.lastName || ""}
            className="header-profile-picture"
          />
        </NavLink>
        <h2>{getTitle()}</h2>
      </div>

      <NavLink to="add-user">
        <PiPlusCircle size={24} color="#00000099" />
      </NavLink>
    </header>
  );
};

export default Header;
