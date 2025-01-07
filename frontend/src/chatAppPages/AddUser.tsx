import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";

const AddUser: React.FC = () => {
  const { user, token, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isRequestSent, setIsRequestSent] = useState(false);

  useEffect(() => {
    console.log("Auth State:", { user, token, isAuthenticated });
  }, [user, token, isAuthenticated]);

  const handleAddUser = async () => {
    if (!isAuthenticated) {
      setMessage("You must be logged in to send a friend request.");
      return;
    }

    try {
      const response = await api.post("/api/user/send-friend-request", {
        senderId: user?.id,
        receiverEmail: email,
      });

      if (response.data.success) {
        setMessage("Friend request Sent.");
        setIsRequestSent(true);
      } else {
        setMessage(
          response.data.message || "This user is not registered with EchoChat."
        );
      }
    } catch (error) {
      setMessage("Error sending request.");
      console.error("Add user error:", error);
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
