import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";
import { uploadFile } from "../utils/fileUpload";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
} from "@mui/material";
import Popover from "@mui/material/Popover";
import PopupState, { bindTrigger, bindPopover } from "material-ui-popup-state";
import { MdOutlineBlock } from "react-icons/md";

const UserProfile: React.FC = () => {
  const { token, user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [profileKey, setProfileKey] = React.useState(0);
  const [isUploading, setIsUploading] = React.useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });
  const [deleteDialog1Open, setDeleteDialog1Open] = useState(false);
  const [deleteDialog2Open, setDeleteDialog2Open] = useState(false);

  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>, PopupState: any) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        alert("Image must be smaller than 5MB");
        return;
      }

      const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
      if (!allowedTypes.includes(file.type)) {
        setSnackbar({
          open: true,
          message: "Only JPEG, PNG, and GIF images are allowed",
        });
        return;
      }

      try {
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        const uploadResponse = await uploadFile(formData);
        const fileurlWithToken = `${uploadResponse.fileUrl}?token=${token}`;

        //update user profile with new avatar url
        await api.patch("/api/user/profile", {
          avatarUrl: fileurlWithToken,
        });

        //update local user state--
        updateUser({ avatarUrl: fileurlWithToken });
        setProfileKey((prev) => prev + 1);
        PopupState.close();
        setSnackbar({ open: true, message: "Image uploaded successfully" });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed. Try again";
        setSnackbar({ open: true, message: errorMessage });
      } finally {
        setIsUploading(false);
      }
    },
    [updateUser, token]
  );

  const handleRemoveImage = async (PopupState: any) => {
    try {
      await api.patch("/api/user/profile", {
        avatarUrl: null,
      });

      updateUser({ avatarUrl: undefined });
      setProfileKey((prev) => prev + 1);
      PopupState.close();
      setSnackbar({ open: true, message: "Image removed successfully" });
    } catch (error) {
      setSnackbar({ open: true, message: "Error removing image:" });
    }
  };

  //initial avatar
  const getInitialsAvatar = () => {
    if (!user) return "";
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  };

  const getAvatarUrl = () => {
    return user?.avatarUrl;
  };

  const handleDeleteAccount = async () => {
    try {
      await api.delete("/api/user/profile/delete");
      await logout();
      navigate("/signup");
    } catch (error) {
      setSnackbar({ open: true, message: "Error deleteing account" });
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <section className="main-container">
      <div className="user-profile-main-container" key={profileKey}>
        <div className="user-profile-image-container">
          {getAvatarUrl() ? (
            <img
              src={getAvatarUrl()}
              alt={getInitialsAvatar() || getAvatarUrl() || "Profile"}
              onError={(e) => {
                console.error("Image load error:", getAvatarUrl());
                e.currentTarget.src = "";
                if (user) {
                  updateUser({ avatarUrl: undefined });
                }
              }}
            />
          ) : (
            <div
              style={{
                width: "170px",
                height: "170px",
                borderRadius: "50%",
                backgroundColor: "#208d7f",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontSize: "3rem",
                fontWeight: "500",
              }}
            >
              {getInitialsAvatar()}
            </div>
          )}
          <div className="no-friends-message button">
            <PopupState variant="popover" popupId="image-management-popover">
              {(popupState) => (
                <>
                  <button
                    id="add-newImg-button"
                    {...bindTrigger(popupState)}
                    disabled={isUploading}
                  >
                    {isUploading ? "Uploading..." : "Edit Image"}
                  </button>

                  <Popover
                    {...bindPopover(popupState)}
                    anchorOrigin={{
                      vertical: "bottom",
                      horizontal: "center",
                    }}
                    transformOrigin={{
                      vertical: "top",
                      horizontal: "center",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        padding: "8px",
                        overflowY: "auto",
                      }}
                    >
                      <Button
                        component="label"
                        variant="text"
                        style={{ justifyContent: "flex-start" }}
                      >
                        Upload Image
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, popupState)}
                        />
                      </Button>
                      <Button
                        variant="text"
                        color="error"
                        onClick={() => handleRemoveImage(popupState)}
                        style={{ justifyContent: "flex-start" }}
                      >
                        Remove Image
                      </Button>
                    </div>
                  </Popover>
                </>
              )}
            </PopupState>
          </div>
        </div>

        <section className="friends-info-section">
          <span>
            <p>First Name</p>
            <h3>{user?.firstName}</h3>
          </span>
          <span>
            <p>Last Name</p>
            <h3>{user?.lastName}</h3>
          </span>
          <span>
            <p>Email Address</p>
            <h3>{user?.email}</h3>
          </span>
          <span>
            <p>Date Joined</p>
            <h3>
              {user?._id
                ? formatDate(
                    new Date(parseInt(user._id.substring(0, 8), 16) * 1000)
                  )
                : "Not Available"}
            </h3>
          </span>
        </section>
      </div>

      <div className="block-user-btn-holder">
        <button
          className="user-blk-btn"
          onClick={() => setDeleteDialog1Open(true)}
        >
          Delete Account <MdOutlineBlock size={20} />
        </button>
      </div>

      <Dialog
        open={deleteDialog1Open}
        onClose={() => setDeleteDialog1Open(false)}
      >
        <DialogTitle>Delete Account</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Do you really want to delete your account?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <button
            className="user-acct-del-btn"
            onClick={() => setDeleteDialog1Open(false)}
          >
            Cancel
          </button>
          <button
            className="user-acct-del-btn"
            onClick={() => {
              setDeleteDialog1Open(false);
              setDeleteDialog2Open(true);
            }}
            style={{ color: "red" }}
          >
            Continue
          </button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialog2Open}
        onClose={() => setDeleteDialog2Open(false)}
      >
        <DialogTitle>Final Confirmation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Deleting your account wipes your info off our database. Would you
            like to continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <button
            className="user-acct-del-btn"
            onClick={() => setDeleteDialog2Open(false)}
          >
            Cancel
          </button>
          <button
            className="user-acct-del-btn"
            onClick={handleDeleteAccount}
            style={{ color: "red" }}
          >
            Delete Account
          </button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </section>
  );
};

export default UserProfile;
