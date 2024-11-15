import { NavLink, Outlet } from "react-router-dom";
import { IoChatboxEllipsesOutline, 
  IoPersonAdd, 
  IoSettingsOutline   } from "react-icons/io5";
import { PiPhoneCallLight, PiFilmReelLight  } from "react-icons/pi";
import "./MainNavigation.css";
import Header from "../chatAppPages/Header";

const MainNavigation: React.FC = () => {
  return (
    <div className="holder">
    <Header />
      <main>
        <Outlet />
      </main>
      <nav className="navbar">
        <NavLink to="chats">
          <IoChatboxEllipsesOutline size={24} />
        </NavLink>
        <NavLink to="calls">
          <PiPhoneCallLight size={24} />
        </NavLink>
        <NavLink to="updates">
          <PiFilmReelLight size={24} />
        </NavLink>
        <NavLink to="requests">
          <IoPersonAdd size={24} />
        </NavLink>
        <NavLink to="settings">
          <IoSettingsOutline size={24} />
        </NavLink>
      </nav>
    </div>
  );
};

export default MainNavigation;
