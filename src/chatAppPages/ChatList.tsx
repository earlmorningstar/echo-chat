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
    {
      id: 3,
      name: "Joel Taylor",
      lastMessage: "Bet!",
      time: "5:59 PM",
      unreadCount: 0,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 4,
      name: "Morningstar FreeAgain",
      lastMessage: "In a giffy bro.",
      time: "9:00 AM",
      unreadCount: 2,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 5,
      name: "Earl To The Izzo",
      lastMessage: "I met Kanye west, I'm never gonna fail.",
      time: "9:00 AM",
      unreadCount: 8,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 6,
      name: "Yamal Lamine",
      lastMessage: "I play better than most people you mentioned!",
      time: "10:00 AM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 7,
      name: "Messi Gonzalo",
      lastMessage: "I play better than most people you mentioned!",
      time: "10:00 AM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 8,
      name: "Arteta Mikel",
      lastMessage: "I play better than most people you mentioned!",
      time: "10:00 AM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 9,
      name: "Pep Stuborn",
      lastMessage: "I play better than most people you mentioned!",
      time: "10:00 AM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 10,
      name: "Wicked Himnow",
      lastMessage: "I play better than most people you mentioned!",
      time: "3:00 PM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 11,
      name: "Grace Grace",
      lastMessage: "I met Kanye west, I'm never gonna fail.",
      time: "9:00 AM",
      unreadCount: 8,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 12,
      name: "Sara Sanders",
      lastMessage: "I play better than most people you mentioned!",
      time: "10:00 AM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 13,
      name: "Doriz Diaz",
      lastMessage: "I play better than most people you mentioned!",
      time: "10:00 AM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 14,
      name: "Dorothy Oliver",
      lastMessage: "I play better than most people you mentioned!",
      time: "10:00 AM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 15,
      name: "Rebecca Fox",
      lastMessage: "I play better than most people you mentioned!",
      time: "10:00 AM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 16,
      name: "Louis McCoy",
      lastMessage: "I play better than most people you mentioned!",
      time: "3:00 PM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 17,
      name: "Jasmine Coolwoman",
      lastMessage: "Hey, are you free tomorrow?",
      time: "10:15 AM",
      unreadCount: 2,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 18,
      name: "Bob",
      lastMessage: "Let's catch up later!",
      time: "9:00 AM",
      unreadCount: 100,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 19,
      name: "Joel",
      lastMessage: "Bet!",
      time: "5:59 PM",
      unreadCount: 0,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 20,
      name: "Morningstar",
      lastMessage: "In a giffy bro.",
      time: "9:00 AM",
      unreadCount: 2,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 21,
      name: "Earl",
      lastMessage: "I met Kanye west, I'm never gonna fail.",
      time: "9:00 AM",
      unreadCount: 8,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 22,
      name: "Yamal",
      lastMessage: "I play better than most people you mentioned!",
      time: "10:00 AM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 23,
      name: "Yamal",
      lastMessage: "I play better than most people you mentioned!",
      time: "10:00 AM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 24,
      name: "Yamal",
      lastMessage: "I play better than most people you mentioned!",
      time: "10:00 AM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 25,
      name: "Yamal",
      lastMessage: "I play better than most people you mentioned!",
      time: "10:00 AM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 26,
      name: "Yamal",
      lastMessage: "I play better than most people you mentioned!",
      time: "3:00 PM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 27,
      name: "Earl",
      lastMessage: "I met Kanye west, I'm never gonna fail.",
      time: "9:00 AM",
      unreadCount: 8,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 28,
      name: "Yamal",
      lastMessage: "I play better than most people you mentioned!",
      time: "10:00 AM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 29,
      name: "Yamal",
      lastMessage: "I play better than most people you mentioned!",
      time: "10:00 AM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 30,
      name: "Yamal",
      lastMessage: "I play better than most people you mentioned!",
      time: "10:00 AM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 31,
      name: "Yamal",
      lastMessage: "I play better than most people you mentioned!",
      time: "10:00 AM",
      unreadCount: 20,
      profileImage: "/images/user-profile-picture.jpeg",
    },
    {
      id: 32,
      name: "Yamal",
      lastMessage: "I play better than most people you mentioned!",
      time: "3:00 PM",
      unreadCount: 20,
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
