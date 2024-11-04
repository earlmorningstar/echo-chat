const nodemailer = require("nodemailer");
const userModel = require("../models/userModel");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST,
  port: process.env.MAILTRAP_PORT,
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS,
  },
});

const createUser = async (req, res) => {
  const { firstName, lastName, email, password, confirmPassword } = req.body;

  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    const existingUser = await userModel.findUserByEmail(req.db, email);
    if (existingUser) {
      console.log("Existing user found with this email:", email);
      return res.status(400).json({
        message: "Email already in use. Try using another email address",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await userModel.createUser(req.db, {
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });

    res.status(201).json({ message: "User created successfully", user });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Error creating user", error });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await userModel.findUserByEmail(req.db, email);
    console.log("User found:", user);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("Password valid:", isPasswordValid);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.status(200).json({ message: "Login successful", user });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Error logging in", error });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email address is required" });
  }

  try {
    const user = await userModel.findUserByEmail(req.db, email);
    if (!user) {
      return res.status(404).json({ message: "User/Email address not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000;

    await userModel.setPasswordResetToken(
      req.db,
      email,
      resetToken,
      resetTokenExpiry
    );

    const resetUrl = `http://localhost:3001/reset-password/${resetToken}`;

    await transporter.sendMail({
      from: '"EchoChat Support Group" <support@echochat.com>',
      to: email,
      subject: "Password Reset Request",
      text: `You requested a password reset. Click here to reset your EchoChat password. Do not click the link if you did not initiate this process.: ${resetUrl}`,
      html: `<p>You requested a password reset. Click <a href="${resetUrl}">here</a> to reset your EchoChat password. Do not click the link if you did not initiate this process.</p>`,
    });

    res
      .status(200)
      .json({ message: "Password reset link has been sent to your email." });
  } catch (error) {
    res.status(500).json({ message: "Error processing password reset", error });
  }
};

const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  try {
    const user = await userModel.findUserByResetToken(req.db, token);
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userModel.updateUserPassword(req.db, user.email, hashedPassword);

    res
      .status(200)
      .json({
        message: "Password reset successful.",
      });
  } catch (error) {
    res.status(500).json({ message: "Error resetting password", error });
  }
};

module.exports = {
  createUser,
  loginUser,
  forgotPassword,
  resetPassword,
};
