import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import { TextField, Snackbar, CircularProgress } from "@mui/material";

const AddUser: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });

  const handleAddUser = async () => {
    if (!isAuthenticated || !user?._id) {
      console.error("Authentication issue:", {
        isAuthenticated,
        userId: user?._id,
        fullUser: user,
      });
      setMessage("You must be logged in to send a friend request");
      setTimeout(() => {
        setMessage("");
      }, 4000);
      return;
    }

    if (!email.trim()) {
      setMessage("Please enter an email address");
      setTimeout(() => {
        setMessage("");
      }, 4000);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setMessage("Please enter a valid email address");
      setTimeout(() => {
        setMessage("");
      }, 4000);
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await api.post("/api/user/send-friend-request", {
        receiverEmail: email.trim(),
      });

      if (response.data.success) {
        setSnackbar({
          open: true,
          message: "Friend request sent successfully",
        });
        setEmail("");
        setTimeout(() => {
          setSnackbar({
            open: false,
            message: "",
          });
        }, 3000);
      } else {
        setMessage(
          response.data.message || "This user is not registered with EchoChat"
        );
      }
    } catch (error: any) {
      console.error("Add user error:", error.response || error);
      const errorMessage =
        error.response?.data?.message ||
        "Error sending friend request. Please try again";
      setMessage(errorMessage);
      setTimeout(() => {
        setMessage("");
      }, 4000);
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
        <p className="add-user-title">Add User</p>
        <span>
          <TextField
            type="email"
            label="Enter user's email"
            variant="standard"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            sx={{
              m: 1,
              width: "35ch",
              ".MuiInputLabel-asterisk": { color: "#F9F4EC" },
            }}
            required
          />
        </span>
        <div className="no-friends-message">
          <button
            onClick={handleAddUser}
            disabled={isSubmitting || !email.trim()}
          >
            {isSubmitting ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              "Add User"
            )}
          </button>
        </div>

        {message && <p className="error-message">{message}</p>}

        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          message={snackbar.message}
        />
      </div>
    </div>
  );
};

export default AddUser;
