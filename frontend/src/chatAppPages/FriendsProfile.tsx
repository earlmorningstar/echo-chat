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

      const [userResponse, friendshipResponse] = await Promise.all([
        api.get(`/api/user/${friendId}`),
        api.get(`/api/user/friendship/${friendId}`),
      ]);

      // const userData = userResponse.data.user as AuthUser;
      // const friendshipCreatedAt = friendshipResponse.data.data.friendship.createdAt;

      // return {
      //   ...userData,
      //   status: getUserStatus(friendId),
      //   friendshipCreatedAt: friendshipCreatedAt ? new Date(friendshipCreatedAt) : undefined
      // };

      const userData = userResponse.data.user as AuthUser;
      const friendshipData = friendshipResponse.data.data.friendship;

      console.log("Friendship Response:", friendshipResponse.data);
      console.log("Friendship Created At:", friendshipData.createdAt);

      let parsedDate: Date | undefined;

      if (friendshipData?.createdAt) {
        // Handle different possible date formats
        if (friendshipData.createdAt instanceof Date) {
          parsedDate = friendshipData.createdAt;
        } else if (typeof friendshipData.createdAt === "string") {
          parsedDate = new Date(friendshipData.createdAt);
        } else if (friendshipData.createdAt.$date) {
          // Handle MongoDB extended JSON format if present
          parsedDate = new Date(friendshipData.createdAt.$date);
        }
      }

      console.log("Parsed Date:", parsedDate);

      return {
        ...userData,
        status: getUserStatus(friendId),
        friendshipCreatedAt: parsedDate,
      };
    },
    enabled: !!friendId,
    staleTime: 1000 * 60,
  });

  const formatDateAdded = (date: Date | undefined) => {
    // if (!date) return "Not available";

    console.log("Formatting date:", date);

    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      console.log("Invalid date received:", date);
      return "Not available";
    }

    try {
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      console.log("Difference in days:", diffDays); // Debug log

      if (diffDays === 1) return "Added yesterday";
      if (diffDays < 7) return `Added ${diffDays} days ago`;
      if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `Added ${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
      }
      if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `Added ${months} ${months === 1 ? "month" : "months"} ago`;
      }

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Not available";
    }

    // const friendshipCreatedAt = new Date(date);
    // const now = new Date();
    // const diffTime = Math.abs(now.getTime() - friendshipCreatedAt.getTime());
    // const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // if (diffDays === 1) return "Added yesterday";
    // if (diffDays < 7) return `Added ${diffDays} days ago`;
    // if (diffDays < 30) {
    //   const weeks = Math.floor(diffDays / 7);
    //   return `Added ${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    // }
    // if (diffDays < 365) {
    //   const months = Math.floor(diffDays / 30);
    //   return `Added ${months} ${months === 1 ? 'month' : 'months'} ago`;
    // }

    // return friendshipCreatedAt.toLocaleDateString("en-US", {
    //   year: "numeric",
    //   month: "long",
    //   day: "numeric"
    // });
  };

  const navigateToChatWindow = () => {
    if (friendId) {
      navigate(`/chat/${friendId}`);
    }
  };

  console.log("Friend data:", friend);

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
          <h3>
            {friend?.friendshipCreatedAt
              ? formatDateAdded(friend.friendshipCreatedAt)
              : "Not available"}
          </h3>
          {/* <h3>{formatDateAdded(friend?.friendshipCreatedAt)}</h3> */}
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
