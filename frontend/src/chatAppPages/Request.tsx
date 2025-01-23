import React, { useState, useEffect } from "react";
import {
  Tabs,
  Tab,
  Box,
  List,
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
     

      if (response.data && response.data.data) {
        setSentRequests(response.data.data.sent || []);
        setReceivedRequests(response.data.data.received || []);
       
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
      setSnackbar({ open: true, message: "Error fetching requests" });
    }
  };

  const handleRequestAction = async (
    requestId: string,
    action: "accept" | "decline"
  ) => {
    try {
      await api.post("/api/user/handle-friend-request", { requestId, action });
      setSnackbar({
        open: true,
        message: `Request ${
          action === "accept" ? "accepted" : "declined"
        } successfully`,
      });
      fetchRequests();
    } catch (error) {
      console.error("Error handling request:", error);
      setSnackbar({ open: true, message: "Error handling request" });
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <div className="main-container">
      <div className="request-container">
        <Box sx={{ width: "100%", typography: "body1" }}>
          <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              aria-label="friend requests tabs"
            >
              <Tab label="Received Requests" />
              <Tab label="Sent Requests" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <List>
              {receivedRequests.map((request: FriendRequest) => (
                <section className="request-flex" key={request._id}>
                  <div className="req-name-and-date">
                    <span>{request.senderName}</span>
                    <p>
                      Date received:{" "}
                      {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="req-action-btn">
                    <button
                      onClick={() => handleRequestAction(request._id, "accept")}
                    >
                      Accept
                    </button>
                    <button
                      id="req-decline"
                      onClick={() =>
                        handleRequestAction(request._id, "decline")
                      }
                    >
                      Decline
                    </button>
                  </span>
                </section>
              ))}
            </List>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <List>
              {sentRequests.map((request: FriendRequest) => (
                <section key={request._id}>
                  <div className="req-name-and-date">
                    <span>{request.receiverName}</span>
                    <p>{`Date sent: ${new Date(
                      request.createdAt
                    ).toLocaleDateString()}`}</p>
                  </div>
                </section>
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
      </div>
    </div>
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
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`friend-request-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default Request;
