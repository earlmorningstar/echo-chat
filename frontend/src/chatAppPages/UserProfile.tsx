import React from "react";
import { MdOutlineBlock } from "react-icons/md";

const UserProfile: React.FC = () => {
  return (
    <section className="main-container">

      <div className="user-profile-main-container">

        <div className="user-profile-image-container">
          <img src="/images/user-profile-picture.jpeg" alt="profile" />
          <div className="no-friends-message button" >
            <button id="add-newImg-button">Edit Image</button>
          </div>
        </div>

        <section className="friends-info-section">
          <span>
            <p>First Name</p>
            <h3>My First Name</h3>
          </span>
          <span>
            <p>Last Name</p>
            <h3>My Last Name</h3>
          </span>
          <span>
            <p>Email Address</p>
            <h3>My Email Address</h3>
          </span>
          <span>
            <p>Date Joined</p>
            <h3>The day I Joined</h3>
          </span>
        </section>
      </div>

      <div className="block-user-btn-holder">
        <button className="user-blk-btn">
          Delete Account <MdOutlineBlock size={20} />
        </button>
      </div>
    </section>
  );
};

export default UserProfile;
