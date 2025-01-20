// import { useNavigate } from "react-router-dom";
import { IoChevronBackOutline } from "react-icons/io5";

const FriendsProfile: React.FC = () => {
  //   const navigate = useNavigate();

  return (
    <section className="friends-profile-main-occontainer">
      <span className="login-redirection-arrow">
        <IoChevronBackOutline size={20} color="#333" />
      </span>
      <h1>This Is A User Profile</h1>
    </section>
  );
};

export default FriendsProfile;
