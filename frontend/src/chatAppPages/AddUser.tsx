import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";

const AddUser: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isRequestSent, setIsRequestSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddUser = async () => {
    if (!isAuthenticated || !user?._id) {
      console.error("Authentication issue:", {
        isAuthenticated,
        userId: user?._id,
        fullUser: user,
      });
      setMessage("You must be logged in to send a friend request.");
      return;
    }

    if (!email.trim()) {
      setMessage("Please enter an email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setMessage("Please enter a valid emmail address");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await api.post("/api/user/send-friend-request", {
        receiverEmail: email.trim(),
      });

      if (response.data.success) {
        setMessage("Friend request sent successfully.");
        setIsRequestSent(true);
        setEmail("");
      } else {
        setMessage(
          response.data.message || "This user is not registered with EchoChat."
        );
      }
    } catch (error: any) {
      console.error("Add user error:", error.responsee || error);
      const errorMessage =
        error.response?.data?.message ||
        "Error sending friend request. Please try again";
      setMessage(errorMessage);
      // console.error("Add user error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="main-container">
      <div className="add-user-page">
        <h2>Add User</h2>
        {process.env.NODE_ENV === "development" && (
          <div style={{ fontSize: "12px", color: "gray" }}>
            Auth status:{" "}
            {isAuthenticated ? "Authenticated" : "Not authenticated"}
            <br />
            User ID: {user?._id || "No user ID"}
          </div>
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter user's email"
          disabled={isSubmitting}
        />
        <button
          onClick={handleAddUser}
          disabled={isSubmitting || !email.trim()}
        >
          {isSubmitting ? "Sending..." : "Add User"}
        </button>
        {message && (
          <p className={isRequestSent ? "success-message" : "error-message"}>
            {message}
          </p>
        )}
        {isRequestSent && <button onClick={() => setMessage("")}>OK</button>}
      </div>
    </div>
  );
};

export default AddUser;
