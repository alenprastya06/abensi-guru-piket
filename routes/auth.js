const express = require("express");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const router = express.Router();

// Login
router.post(
  "/login",
  [
    body("username").notEmpty().withMessage("Username diperlukan"),
    body("password").notEmpty().withMessage("Password diperlukan"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;
      const user = await User.findByUsername(username);

      if (!user) {
        return res
          .status(401)
          .json({ message: "Username atau password salah" });
      }

      const isValidPassword = await User.verifyPassword(
        password,
        user.password
      );
      if (!isValidPassword) {
        return res
          .status(401)
          .json({ message: "Username atau password salah" });
      }

      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "8h" }
      );

      res.json({
        message: "Login berhasil",
        token,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
          class_id: user.class_id,
          class_name: user.class_name,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

module.exports = router;
