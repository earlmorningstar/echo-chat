import { NavLink, Outlet } from "react-router-dom";
import {
  // IoChatboxEllipsesOutline,
  IoPersonAdd,
  // IoSettingsOutline,
} from "react-icons/io5";
// import { PiPhoneCallLight, PiFilmReelLight  } from "react-icons/pi";

import { RiMessage2Fill } from "react-icons/ri";
import { BsFillTelephoneFill } from "react-icons/bs";
import { PiFilmReelFill } from "react-icons/pi";
import { RiSettings3Fill } from "react-icons/ri";

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
          <RiMessage2Fill size={22} />
        </NavLink>
        <NavLink to="calls">
          <BsFillTelephoneFill size={22} />
        </NavLink>
        <NavLink to="updates">
          <PiFilmReelFill size={22} />
        </NavLink>
        <NavLink to="requests">
          <IoPersonAdd size={22} />
        </NavLink>
        <NavLink to="settings">
          <RiSettings3Fill size={22} />
        </NavLink>
      </nav>
    </div>
  );
};

export default MainNavigation;
