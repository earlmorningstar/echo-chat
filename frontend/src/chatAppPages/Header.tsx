import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PiPlusCircle } from "react-icons/pi";
import "./ChatAppStyles.css";

const Header: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

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
    if (!user) return '';
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  };

  return (
    <header className="header">
      <div>
        <NavLink className='header-navlink' to="user-profile">
          <span>
          {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt="Profile"
                className="profile-picture"
                onError={(e) => {
                  e.currentTarget.src = `/default-avatar/${getInitialsAvatar()}`;
                  console.warn("Failed to load profile image, using default");
                }}
              />
            ) : (
              <div 
                className="profile-picture"
                style={{
                  backgroundColor: '#208d7f',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  width: '40px', 
                  height: '40px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  textDecoration: "none"
                }}
              >
                {getInitialsAvatar()}
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
