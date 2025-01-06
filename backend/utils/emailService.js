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

module.exports = {
  sendVerificationEmail,
  sendPasswordResetCode,
};
