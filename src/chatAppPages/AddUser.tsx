import { useState, useContext, useEffect } from "react";
import { UserContext } from "../store/userContext";

const AddUser: React.FC = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isRequestSent, setIsRequestSent] = useState(false);

  const userContext = useContext(UserContext);
  const user = userContext?.user;

  useEffect(() => {
    if (!user) {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        userContext?.setUser(JSON.parse(storedUser));
      }
    }
    console.log("User Context in AddUser:", userContext);
  }, [userContext, user]);

  const handleAddUser = async () => {
    if (!user) {
      setMessage("You must be logged in to send a friend request.");
      return;
    }

    const senderId = user._id;
    const token = localStorage.getItem("token");

    if (!token) {
      setMessage("Authentication error. Please log in again.");
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:3000/api/user/add-friend",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            senderId,
            receiverEmail: email,
          }),
        }
      );

      const data = await response.json();
      if (response.ok && data.success) {
        setMessage("Request Sent.");
        setIsRequestSent(true);
      } else {
        setMessage(
          data.message || "This user is not registered with EchoChat."
        );
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
