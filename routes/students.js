const express = require("express");
const { body, validationResult } = require("express-validator");
const Student = require("../models/Student");
const { authenticateToken, authorizeRole } = require("../middleware/auth");
const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    let students;
    if (req.user.role === "admin") {
      students = await Student.getAll();
    } else {
      students = await Student.getByClass(req.user.class_id);
    }
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post(
  "/",
  authenticateToken,
  authorizeRole(["admin"]),
  [
    body("student_id").notEmpty().withMessage("NIS siswa diperlukan"),
    body("full_name").notEmpty().withMessage("Nama lengkap diperlukan"),
    body("class_id").isInt().withMessage("ID kelas harus berupa angka"),
    body("gender").isIn(["L", "P"]).withMessage("Gender harus L atau P"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const studentId = await Student.create(req.body);
      res
        .status(201)
        .json({ message: "Siswa berhasil ditambahkan", studentId });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ message: "NIS siswa sudah ada" });
      }
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Update student
router.put(
  "/:id",
  authenticateToken,
  authorizeRole(["admin"]),
  async (req, res) => {
    try {
      const affectedRows = await Student.update(req.params.id, req.body);
      if (affectedRows === 0) {
        return res.status(404).json({ message: "Siswa tidak ditemukan" });
      }
      res.json({ message: "Data siswa berhasil diupdate" });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Delete student
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole(["admin"]),
  async (req, res) => {
    try {
      const affectedRows = await Student.delete(req.params.id);
      if (affectedRows === 0) {
        return res.status(404).json({ message: "Siswa tidak ditemukan" });
      }
      res.json({ message: "Siswa berhasil dihapus" });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

module.exports = router;
