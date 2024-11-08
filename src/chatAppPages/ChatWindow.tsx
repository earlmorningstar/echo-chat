import { useParams } from "react-router-dom";
import { useState } from "react";

function ChatWindow() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([
    { id: 1, sender: "User", text: "Hello!", timestamp: "10:00 AM" },
    { id: 2, sender: "Participant", text: "Hi there!", timestamp: "10:01 AM" },
  ]);
  const [newMessage, setNewMessage] = useState("");

  const handleSendMessage = () => {
    if (newMessage.trim() === "") return;

    setMessages((prevMessages) => [
      ...prevMessages,
      { id: Date.now(), sender: "User", text: newMessage, timestamp: "Now" },
    ]);
    setNewMessage("");
  };

  return (
    <div className="chat-window">
      <div className="messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${
              message.sender === "User" ? "sent" : "received"
            }`}
          >
            <span className="message-text">{message.text}</span>
            <span className="message-timestamp">{message.timestamp}</span>
          </div>
        ))}
      </div>
      <div className="message-input">
        <input
          type="text"
          placeholder="Type your message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  );
}

export default ChatWindow;
