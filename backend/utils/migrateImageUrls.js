import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "echochat";

if (!MONGODB_URI) {
  console.error("❌  MONGODB_URI environment variable is required.");
  process.exit(1);
}

const toRelative = (url) => {
  if (!url || !url.startsWith("http")) return url;
  try {
    const { pathname } = new URL(url);
    return pathname; // "/api/uploads/files/abc"
  } catch {
    return url;
  }
};

const run = async () => {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    // --- Fix Message.content (image/file URLs) ---
    const messages = db.collection("messages");
    const brokenMessages = await messages
      .find({
        content: { $regex: "^https?://", $options: "i" },
        type: { $in: ["image", "file"] },
      })
      .toArray();

    console.log(
      `Found ${brokenMessages.length} message(s) with absolute URLs.`,
    );

    let msgFixed = 0;
    for (const msg of brokenMessages) {
      const update = {};
      const relContent = toRelative(msg.content);
      if (relContent !== msg.content) update.content = relContent;

      if (msg.metadata?.fileUrl) {
        const relFileUrl = toRelative(msg.metadata.fileUrl);
        if (relFileUrl !== msg.metadata.fileUrl) {
          update["metadata.fileUrl"] = relFileUrl;
        }
      }

      if (Object.keys(update).length > 0) {
        await messages.updateOne({ _id: msg._id }, { $set: update });
        msgFixed++;
      }
    }

    console.log(`Fixed ${msgFixed} message document(s).`);

    // --- Fix User.avatarUrl ---
    const users = db.collection("users");
    const brokenUsers = await users
      .find({ avatarUrl: { $regex: "^https?://", $options: "i" } })
      .toArray();

    console.log(`Found ${brokenUsers.length} user(s) with absolute avatarUrl.`);

    let usersFixed = 0;
    for (const u of brokenUsers) {
      const relAvatar = toRelative(u.avatarUrl);
      if (relAvatar !== u.avatarUrl) {
        await users.updateOne(
          { _id: u._id },
          { $set: { avatarUrl: relAvatar } },
        );
        usersFixed++;
      }
    }

    console.log(`Fixed ${usersFixed} user document(s).`);
    console.log("Migration complete.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await client.close();
  }
};

run();
