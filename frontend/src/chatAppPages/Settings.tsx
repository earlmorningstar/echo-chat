import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
} from "@mui/material";

const Settings: React.FC = () => {
  const [openLogoutDialog, setOpenLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { logout } = useAuth();

  const handleLogoutClick = () => {
    setOpenLogoutDialog(true);
  };

  const handleLogoutConfirm = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed', error");
    } finally {
      setIsLoggingOut(false);
      setOpenLogoutDialog(false);
    }
  };

  const handleLogoutCancel = () => {
    setOpenLogoutDialog(false);
  };

  return (
    <section className="main-container">
      <div className="add-user-page">
        <p className="add-user-title">App Settings</p>
        <span className="req-action-btn">
          <button  onClick={handleLogoutClick}>
          Logout
        </button>
        </span>
        

        <Dialog open={openLogoutDialog} onClose={handleLogoutCancel}>
          <DialogTitle>Confirm Logout</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to logout?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleLogoutCancel} color="primary">
              Cancel
            </Button>
            <Button
              onClick={handleLogoutConfirm}
              color="error"
              disabled={isLoggingOut}
            >
              {isLoggingOut ? <CircularProgress size={20} /> : "Logout"}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </section>
  );
};

export default Settings;
