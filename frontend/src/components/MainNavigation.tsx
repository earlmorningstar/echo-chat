import { NavLink, Outlet } from "react-router-dom";
import { IoPersonAdd } from "react-icons/io5";
import { RiMessage2Fill } from "react-icons/ri";
import { IoMdCall } from "react-icons/io";
// import { PiFilmReelFill } from "react-icons/pi";
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
          <IoMdCall size={22} />
        </NavLink>
        {/* <NavLink to="updates">
          <PiFilmReelFill size={22} />
        </NavLink> */}
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
