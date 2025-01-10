const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const sendVerificationEmail = async (email, verificationCode) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Verify Your EchoChat Account",
    html: `<h1>Welcome to EchoChat!</h1>
      <p>Your account creation verification code is: <strong>${verificationCode}</strong></p>
      <p>This code will expire in 10 minutes.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Failed to send verification email");
  }
};

const sendPasswordResetCode = async (email, resetCode) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Reset Your EchoChat Password",
    html: `<h1>Password Reset Request</h1>
      <p>Your EchoChat password reset code is: <strong>${resetCode}</strong></p>
      <p>This code will expire in 10 minutes.</p>
      <p>Please ignore this email if you didn't request this.</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending reset code email:", error);
    throw new Error("Failed to send reset code email");
  }
};

const sendFriendRequestNotificationEmail = async (
  receiverEmail,
  receiverFirstName,
  senderFullName
) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: receiverEmail,
    subject: "You've Got a Friend Request!",
    html: `
    <h1>You've Got a Friend Request!</h1>
      <p>Hi ${receiverFirstName},</p>
      <p>Exciting news! <b>${senderFullName}</b> has sent you a friend request.</p>
      <p>Take the next step and connect with them to start sharing and chatting!</p>
      <p>Login to EchoChat to accept their request and start building your connection.</p>
      <p>We can't wait to see the connection you'll build.</p>
      <p>Best regards,<br>EchoChat Team</p>
    `,
  };
  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending friend request notification email:", error);
    throw new Error("Failed to send friend request notification");
  }
};

const sendFriendRequestAcceptedEmail = async (
  senderEmail,
  senderFirstName,
  accepterName
) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: senderEmail,
    subject: "Your Friend Request has been Accepted",
    html: `
      <h1>Friend Request Accepted!</h1>
      <p>Hi ${senderFirstName},</p>
      <p>Great news! <b>${accepterName}</b> has accepted your friend request. You're now connected and can start your first conversation!</p>
      <p>Don't wait – send your first message now and break the ice.</p>
      <p>We're excited to see your connection grow!</p>
      <p>Best regards,<br>EchoChat Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending friend request accepted email:", error);
    throw new Error("Failed to send friend request accepted notification");
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetCode,
  sendFriendRequestNotificationEmail,
  sendFriendRequestAcceptedEmail,
};
