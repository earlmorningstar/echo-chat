import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";

const AddUser: React.FC = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isRequestSent, setIsRequestSent] = useState(false);
  const { user, token } = useAuth();

  const handleAddUser = async () => {
    if (!user || !token) {
      setMessage("You must be logged in to send a friend request.");
      return;
    }

    try {
      const response = await api.post("/api/user/add-friend", {
        senderId: user.id,
        receiverEmail: email,
      });

      if (response.data.success) {
        setMessage("Request Sent.");
        setIsRequestSent(true);
      } else {
        setMessage(response.data.message || "This user is not registered with EchoChat.");
      }
    } catch (error) {
      setMessage("Error sending request.");
    }
  };

  return (
    <div className="main-container">
      <div className="add-user-page">
        <h2>Add User</h2>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter user's email"
        />
        <button onClick={handleAddUser}>Add User</button>
        {message && <p>{message}</p>}
        {isRequestSent && <button onClick={() => setMessage("")}>OK</button>}
      </div>
    </div>
  );
};

export default AddUser;