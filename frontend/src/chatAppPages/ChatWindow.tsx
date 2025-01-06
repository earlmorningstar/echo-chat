import { useEffect, useState } from "react";
// import { useParams } from "react-router-dom";

function ChatWindow() {
  // const { chatId } = useParams();
  const [messages, setMessages] = useState([
    { id: 1, sender: "User", text: "Hello!", timestamp: "10:00 AM" },
    { id: 2, sender: "Participant", text: "Hi there!", timestamp: "10:01 AM" },
  ]);
  const [newMessage, setNewMessage] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket server
    const socket = new WebSocket("ws://localhost:3001");
    setWs(socket);

    // Handle incoming messages
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages((prevMessages) => [...prevMessages, message]);
    };

    // Clean up WebSocket connection when the component unmounts
    return () => {
      socket.close();
    };
  }, []);

  const handleSendMessage = () => {
    if (newMessage.trim() === "" || !ws) return;

    const message = {
      id: Date.now(),
      sender: "User",
      text: newMessage,
      timestamp: new Date().toLocaleTimeString(),
    };

    // Send message to the WebSocket server
    ws.send(JSON.stringify(message));

    // Update local message list (optional: this will be replaced by the incoming broadcast)
    setMessages((prevMessages) => [...prevMessages, message]);
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
