const express = require("express");
const Class = require("../models/Class");
const { authenticateToken, authorizeRole } = require("../middleware/auth");
const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const classes = await Class.getAll();
    res.json(classes);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post(
  "/",
  authenticateToken,
  authorizeRole(["admin"]),
  async (req, res) => {
    try {
      const classId = await Class.create(req.body);
      res.status(201).json({ message: "Kelas berhasil ditambahkan", classId });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

module.exports = router;
