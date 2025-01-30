import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PiPlusCircle } from "react-icons/pi";
import "./ChatAppStyles.css";

const Header: React.FC = () => {
  const location = useLocation();
  const { user, updateUser } = useAuth();

  const getTitle = () => {
    switch (location.pathname) {
      case "/main-navigation/chats":
        return "Chats";
      case "/main-navigation/calls":
        return "Calls";
      case "/main-navigation/updates":
        return "Updates";
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

  const getInitialsAvatar = () => {
    if (!user) return "";
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  };

  const getAvatarUrl = () => {
    return user?.avatarUrl;
  };

  return (
    <header className="header">
      <div>
        <NavLink className="header-navlink" to="user-profile">
          <span>
            {getAvatarUrl() ? (
              <img
                src={getAvatarUrl()}
                alt={getInitialsAvatar() || getAvatarUrl() || "Profile"}
                className="header-profile-picture"
                onError={(e) => {
                  console.error("Image load error:", getAvatarUrl());
                  e.currentTarget.src = "";
                  if (user) {
                    updateUser({ avatarUrl: undefined });
                  }
                }}
              />
            ) : (
              <div className="profile-picture">
                <span>{getInitialsAvatar()}</span>
              </div>
            )}
          </span>
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
