import { useEffect, useState } from "react";

interface FriendRequest {
  id: string;
  senderEmail: string;
}

function Request() {
  const [requests, setRequests] = useState<FriendRequest[]>([]);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const response = await fetch(
          "http://localhost:3000/api/users/friend-requests",
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const data = await response.json();
        setRequests(data.requests);
      } catch (error) {
        console.error("Error fetching friend requests", error);
      }
    };

    fetchRequests();
  }, []);

  const handleAccept = async (requestId: string) => {
    try {
      const response = await fetch(`/api/users/accept-request/${requestId}`, {
        method: "POST",
      });
      if (response.ok) {
        setRequests(requests.filter((req) => req.id !== requestId));
      }
    } catch (error) {
      console.error("Error accepting request", error);
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      const response = await fetch(`/api/users/decline-request/${requestId}`, {
        method: "POST",
      });
      if (response.ok) {
        setRequests(requests.filter((req) => req.id !== requestId));
      }
    } catch (error) {
      console.error("Error declining request", error);
    }
  };

  return (
    <div className="main-container">
      <div className="request-page">
        <h2>Friend Requests</h2>
        {requests.length === 0 ? (
          <p>No pending requests.</p>
        ) : (
          requests.map((request) => (
            <div key={request.id} className="request-item">
              <p>{request.senderEmail} has sent you a friend request.</p>
              <button onClick={() => handleAccept(request.id)}>Accept</button>
              <button onClick={() => handleDecline(request.id)}>Decline</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Request;
