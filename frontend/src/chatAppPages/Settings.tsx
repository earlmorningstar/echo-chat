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
      <div className="settings-main-container">
        <h1>Settings</h1>
        <Button variant="contained" color="primary" onClick={handleLogoutClick}>
          Logout
        </Button>

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
              color="primary"
              disabled={isLoggingOut}
            >
              {isLoggingOut ? <CircularProgress size={24} /> : "Logout"}
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </section>
  );
};

export default Settings;
