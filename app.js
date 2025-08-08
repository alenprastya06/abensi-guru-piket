// app.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/students");
const attendanceRoutes = require("./routes/attendances");
const classRoutes = require("./routes/classes");
const userRoutes = require("./routes/users"); // Tambahkan ini

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/attendances", attendanceRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/users", userRoutes); // Tambahkan ini

// Default route
app.get("/", (req, res) => {
  res.json({ message: "API Absensi Siswa" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
