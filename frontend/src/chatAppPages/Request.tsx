import React, { useState, useEffect } from "react";
import {
  Tabs,
  Tab,
  Box,
  List,
  ListItem,
  ListItemText,
  Button,
  Snackbar,
} from "@mui/material";
import { useAuth } from "../contexts/AuthContext";
import api from "../utils/api";

interface FriendRequest {
  _id: string;
  senderName: string;
  receiverName: string;
  status: string;
  createdAt: Date;
}

const Request: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });
  const { token } = useAuth();

  useEffect(() => {
    fetchRequests();
  }, [token]);

  const fetchRequests = async () => {
    try {
      const response = await api.get("/api/user/friend-requests");
      setSentRequests(response.data.data.sent);
      setReceivedRequests(response.data.data.received);
    } catch (error) {
      setSnackbar({ open: true, message: "Error fetching requests" });
    }
  };

  const handleRequestAction = async (
    requestId: string,
    action: "accept" | "decline"
  ) => {
    try {
      await api.post("/api/user/handle-request", { requestId, action });
      setSnackbar({
        open: true,
        message: `Request ${
          action === "accept" ? "accepted" : "declined"
        } successfully`,
      });
      fetchRequests();
    } catch (error) {
      setSnackbar({ open: true, message: "Error handling request" });
    }
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
        <Tab label="Received Requests" />
        <Tab label="Sent Requests" />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <List>
          {receivedRequests.map((request) => (
            <ListItem key={request._id}>
              <ListItemText
                primary={request.senderName}
                secondary={new Date(request.createdAt).toLocaleDateString()}
              />
              <Button
                onClick={() => handleRequestAction(request._id, "accept")}
                color="primary"
              >
                Accept
              </Button>
              <Button
                onClick={() => handleRequestAction(request._id, "decline")}
                color="secondary"
              >
                Decline
              </Button>
            </ListItem>
          ))}
        </List>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <List>
          {sentRequests.map((request) => (
            <ListItem key={request._id}>
              <ListItemText
                primary={request.receiverName}
                secondary={`Status: ${request.status}`}
              />
            </ListItem>
          ))}
        </List>
      </TabPanel>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default Request;
