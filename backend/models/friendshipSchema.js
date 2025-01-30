const setupFriendshipCollections = async (db) => {
  try {
    // Drop existing indexes
    try {
      await db.collection("friendships").dropIndexes();
      } catch (error) {
      console.error("No existing indexes to drop");
    }

    // Remove any invalid documents (those with null user IDs)
    await db.collection("friendships").deleteMany({
      $or: [
        { user1Id: null },
        { user2Id: null },
        { user1Id: { $exists: false } },
        { user2Id: { $exists: false } },
      ],
    });

    //creating indexes
    await db.collection("friendships").createIndexes([
      {
        key: { user1Id: 1, user2Id: 1 },
        unique: true,
        name: "unique_friendship",
        partialFilterExpression: {
          user1Id: { $type: "string" },
          user2Id: { $type: "string" },
        },
      },
      {
        key: { status: 1 },
        name: "friendship_status",
      },
      {
        key: { createdAt: -1 },
        name: "friendship_created_at",
      },
    ]);

    // Similar cleanup for friendrrequests
    await db.collection("friendRequests").dropIndexes();

    await db.collection("friendRequests").deleteMany({
      $or: [
        { senderId: null },
        { receiverId: null },
        { senderId: { $exists: false } },
        { receiverId: { $exists: false } },
      ],
    });

    // Create indexes for friendRequests collection
    await db.collection("friendRequests").createIndexes([
      {
        key: { senderId: 1, receiverId: 1 },
        unique: true,
        name: "unique_request",
        partialFilterExpression: {
          senderId: { $type: "string" },
          receiverId: { $type: "string" },
        },
      },
      {
        key: { status: 1 },
        name: "request_status",
      },
      {
        key: { createdAt: -1 },
        name: "request_created_at",
      },
    ]);
  } catch (error) {
    console.error("Error setting up friendship collections");
  }
};

const migrateFriendshipData = async (db) => {
  try {
    const users = await db.collection("users").find({}).toArray();

    for (const user of users) {
      const friends = user.friends || [];

      for (const friendId of friends) {
        await db.collection("friendships").updateOne(
          {
            $or: [
              { user1Id: user._id.toString(), user2Id: friendId.toString() },
              { user1Id: friendId.toString(), user2Id: user._id.toString() },
            ],
          },
          {
            $setOnInsert: {
              user1Id: user._id.toString(),
              user2Id: friendId.toString(),
              status: "accepted",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );
      }
    }
  } catch (error) {
    console.error("Error migrating friendship data");
  }
};

export { setupFriendshipCollections, migrateFriendshipData };
