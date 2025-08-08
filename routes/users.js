// routes/users.js
const express = require("express");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const { authenticateToken, authorizeRole } = require("../middleware/auth");
const router = express.Router();

router.post(
  "/",
  authenticateToken,
  authorizeRole(["admin"]),
  [
    body("username")
      .notEmpty()
      .withMessage("Username diperlukan")
      .isLength({ min: 3 })
      .withMessage("Username minimal 3 karakter"),
    body("email").isEmail().withMessage("Format email tidak valid"),
    body("password")
      .notEmpty()
      .withMessage("Password diperlukan")
      .isLength({ min: 6 })
      .withMessage("Password minimal 6 karakter"),
    body("full_name").notEmpty().withMessage("Nama lengkap diperlukan"),
    body("role").isIn(["admin", "secretary"]).withMessage("Role tidak valid"),
    body("class_id")
      .optional({ nullable: true })
      .isInt()
      .withMessage("Class ID harus berupa angka")
      .custom((value, { req }) => {
        if (req.body.role === "secretary" && !value) {
          throw new Error("Class ID diperlukan untuk role secretary");
        }
        return true;
      }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, email, password, full_name, role, class_id } = req.body;
      const existingUser = await User.findByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username sudah digunakan" });
      }

      const newUserId = await User.create({
        username,
        email,
        password,
        full_name,
        role,
        class_id: role === "secretary" ? class_id : null,
      });

      res
        .status(201)
        .json({ message: "Pengguna berhasil dibuat", userId: newUserId });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

module.exports = router;
