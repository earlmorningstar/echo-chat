import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "../contexts/ChatContext";
import { formatLastSeen } from "../utils/chatUtils";
import api from "../utils/api";
import type { AuthUser } from "../types";
import { IoChevronBackOutline } from "react-icons/io5";
import { SlOptions } from "react-icons/sl";
import { IoMdCall, IoMdVideocam } from "react-icons/io";
import { RiMessage2Fill } from "react-icons/ri";
import { MdOutlineBlock } from "react-icons/md";

const FriendsProfile: React.FC = () => {
  const navigate = useNavigate();
  const { friendId } = useParams<{ friendId: string }>();
  const { getUserStatus } = useChat();

  const { data: friend } = useQuery({
    queryKey: ["friend", friendId],
    queryFn: async () => {
      if (!friendId) throw new Error("No friend ID provided");

      const userResponse = await api.get(`/api/user/${friendId}`);
      const friendshipResponse = await api.get(
        `/api/user/friendship/${friendId}`
      );

      const userData = userResponse.data.user as AuthUser;
      const friendshipData = friendshipResponse.data.data?.friendship;

      return {
        ...userData,
        status: getUserStatus(friendId),
        friendsSince: friendshipData?.createdAt
          ? new Date(friendshipData.createdAt)
          : undefined,
      };
    },
    enabled: !!friendId,
    staleTime: 1000 * 60,
  });

  const formatDateAdded = (date: Date | undefined) => {
    if (!date) return "Not available";

    const friendsSince = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - friendsSince.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "Added yesterday";
    if (diffDays < 7) return `Added ${diffDays} days ago`;
    if (diffDays < 30) return `Added ${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `Added ${Math.floor(diffDays / 30)} months ago`;

    return `Added on ${friendsSince.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`;
  };

  const navigateToChatWindow = () => {
    if (friendId) {
      navigate(`/chat/${friendId}`);
    }
  };

  return (
    <section className="friends-profile-main-container">
      <span
        className="userProfile-redirection-arrow"
        onClick={navigateToChatWindow}
      >
        <IoChevronBackOutline size={25} color="#333" />
      </span>

      <div className="friends-details-section">
        <span className="friends-profile-image-container">
          {friend?.avatarUrl ? (
            <img src={friend.avatarUrl} alt="Profile" />
          ) : (
            <div className="default-avatar">
              {friend?.firstName?.[0]}
              {friend?.lastName?.[0]}
            </div>
          )}
        </span>
        <h2>
          {friend
            ? `${friend.firstName} ${friend.lastName}`
                .split(" ")
                .map(
                  (name) =>
                    `${name.charAt(0).toUpperCase()}${name
                      .slice(1)
                      .toLowerCase()}`
                )
                .join(" ")
            : "Loading..."}
        </h2>

        <section>
          <span onClick={navigateToChatWindow}>
            <RiMessage2Fill size={25} color="#208d7f" />
          </span>
          <span>
            <IoMdCall size={25} color="#208d7f" />
          </span>
          <span>
            <IoMdVideocam size={25} color="#208d7f" />
          </span>
          <span>
            <SlOptions size={25} color="#208d7f" />
          </span>
        </section>
      </div>

      <div className="friends-info-section">
        <span>
          <p>First Name</p>
          <h3>
            {friend?.firstName.charAt(0).toUpperCase()}
            {friend?.firstName.slice(1).toLowerCase() || "Loading..."}
          </h3>
        </span>
        <span>
          <p>Last Name</p>
          <h3>
            {friend?.lastName.charAt(0).toUpperCase()}
            {friend?.lastName.slice(1).toLowerCase() || "Loading..."}
          </h3>
        </span>
        <span>
          <p>Email Address</p>
          <h3>{friend?.email || "Loading..."}</h3>
        </span>
        <span>
          <p>Date Added</p>
          <h3>{formatDateAdded(friend?.friendsSince)}</h3>
        </span>
        <span>
          <p>Status</p>
          <h3>
            {friend?.status === "online"
              ? "Online"
              : formatLastSeen(friend?.lastSeen)}
          </h3>
        </span>
      </div>

      <div className="block-user-btn-holder">
        <button className="user-blk-btn">
          Block User <MdOutlineBlock size={20} />
        </button>
      </div>
    </section>
  );
};

export default FriendsProfile;
