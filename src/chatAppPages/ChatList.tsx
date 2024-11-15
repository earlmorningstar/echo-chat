import { useNavigate } from "react-router-dom";
import "./ChatAppStyles.css";

function ChatList() {
  const navigate = useNavigate();

  const handleChatClick = (chatId: number) => {
    navigate(`/main-navigation/chat/${chatId}`);
  };

  const chats = [
    {
      id: 1,
      name: "Alice Joy",
      lastMessage: "Hey, are you free tomorrow?",
      time: "10:15 AM",
      unreadCount: 2,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 2,
      name: "Bob Freeman",
      lastMessage: "Let's catch up later!",
      time: "9:00 AM",
      unreadCount: 100,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    
  ];

  return (
    <div className="main-container">
      <div className="chat-list">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className="chat-item"
            onClick={() => handleChatClick(chat.id)}
          >
            <img
              src={chat.profileImage}
              alt={`${chat.name}'s profile`}
              className="profile-image"
            />
            <div className="chat-info">
              <div className="chat-name">{chat.name}</div>
              <div className="chat-last-message">{chat.lastMessage}</div>
            </div>
            <div className="chat-meta">
              <div className="chat-time">{chat.time}</div>
              {chat.unreadCount > 0 && (
                <div className="chat-unread-count">{chat.unreadCount}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ChatList;
