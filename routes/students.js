const express = require("express");
const { body, validationResult } = require("express-validator");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const Student = require("../models/Student");
const Class = require("../models/Class"); // Assuming you have a Class model
const { authenticateToken, authorizeRole } = require("../middleware/auth");
const router = express.Router();

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file Excel (.xlsx, .xls) yang diizinkan"), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// GET all students (existing functionality)
router.get("/", authenticateToken, async (req, res) => {
  try {
    let students;
    if (req.user.role === "admin") {
      students = await Student.getAll();
    } else {
      students = await Student.getByClass(req.user.class_id);
    }
    res.json({
      message: "Data siswa berhasil diambil",
      data: students,
      count: students.length,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// DOWNLOAD Excel template - NEW ROUTE
router.get(
  "/template/download",
  authenticateToken,
  authorizeRole(["admin"]),
  async (req, res) => {
    try {
      // Get all classes for reference
      const classes = await Class.getAll(); // Assuming you have this method

      // Create sample data for template
      const templateData = [
        {
          student_id: "2024001",
          full_name: "Contoh Nama Siswa",
          class_id: 1,
          gender: "L",
          birth_date: "2008-01-15",
          address: "Jl. Contoh No. 123, Jakarta",
          phone: "08123456789",
          parent_phone: "08987654321",
        },
      ];

      // Create classes reference sheet
      const classesData = classes.map((cls) => ({
        class_id: cls.id,
        class_name: cls.class_name,
        grade_level: cls.grade_level,
        academic_year: cls.academic_year,
      }));

      // Create instructions
      const instructions = [
        {
          field: "student_id",
          description: "NIS Siswa (wajib, unik)",
          example: "2024001",
        },
        {
          field: "full_name",
          description: "Nama Lengkap (wajib)",
          example: "Ahmad Budi Santoso",
        },
        {
          field: "class_id",
          description: "ID Kelas (wajib, lihat sheet Daftar_Kelas)",
          example: "1",
        },
        {
          field: "gender",
          description: "Jenis Kelamin (wajib: L/P)",
          example: "L",
        },
        {
          field: "birth_date",
          description: "Tanggal Lahir (format: YYYY-MM-DD)",
          example: "2008-01-15",
        },
        {
          field: "address",
          description: "Alamat",
          example: "Jl. Merdeka No. 45, Jakarta",
        },
        { field: "phone", description: "No. HP Siswa", example: "08123456789" },
        {
          field: "parent_phone",
          description: "No. HP Orang Tua",
          example: "08987654321",
        },
      ];

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Add template sheet
      const templateSheet = XLSX.utils.json_to_sheet(templateData);
      XLSX.utils.book_append_sheet(workbook, templateSheet, "Template_Siswa");

      // Add classes reference sheet
      const classesSheet = XLSX.utils.json_to_sheet(classesData);
      XLSX.utils.book_append_sheet(workbook, classesSheet, "Daftar_Kelas");

      // Add instructions sheet
      const instructionsSheet = XLSX.utils.json_to_sheet(instructions);
      XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Petunjuk");

      // Generate buffer
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      // Set headers for download
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Template_Data_Siswa_${
          new Date().toISOString().split("T")[0]
        }.xlsx"`
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        message: "Gagal mengunduh template",
        error: error.message,
      });
    }
  }
);

// UPLOAD Excel file for bulk import - NEW ROUTE
router.post(
  "/import/excel",
  authenticateToken,
  authorizeRole(["admin"]),
  upload.single("excel_file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "File Excel diperlukan",
        });
      }

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0]; // Use first sheet
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        return res.status(400).json({
          message: "File Excel kosong atau tidak memiliki data",
        });
      }

      // Validate and process data
      const validStudents = [];
      const errors = [];
      const duplicateStudentIds = [];

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNumber = i + 2; // +2 because row 1 is header and array is 0-indexed

        // Validate required fields
        const validationErrors = [];

        if (!row.student_id) {
          validationErrors.push("NIS siswa diperlukan");
        }
        if (!row.full_name) {
          validationErrors.push("Nama lengkap diperlukan");
        }
        if (!row.class_id || !Number.isInteger(Number(row.class_id))) {
          validationErrors.push("ID kelas harus berupa angka");
        }
        if (!row.gender || !["L", "P"].includes(row.gender)) {
          validationErrors.push("Gender harus L atau P");
        }

        // Check for duplicate student_id in database
        if (row.student_id) {
          const exists = await Student.existsByStudentId(row.student_id);
          if (exists) {
            duplicateStudentIds.push({
              row: rowNumber,
              student_id: row.student_id,
            });
          }
        }

        if (validationErrors.length > 0) {
          errors.push({
            row: rowNumber,
            errors: validationErrors,
            data: row,
          });
        } else {
          // Format data
          validStudents.push({
            student_id: String(row.student_id).trim(),
            full_name: String(row.full_name).trim(),
            class_id: Number(row.class_id),
            gender: String(row.gender).trim().toUpperCase(),
            birth_date: row.birth_date
              ? new Date(row.birth_date).toISOString().split("T")[0]
              : null,
            address: row.address ? String(row.address).trim() : null,
            phone: row.phone ? String(row.phone).trim() : null,
            parent_phone: row.parent_phone
              ? String(row.parent_phone).trim()
              : null,
          });
        }
      }

      // If there are validation errors or duplicates, return them
      if (errors.length > 0 || duplicateStudentIds.length > 0) {
        return res.status(400).json({
          message: "Terdapat kesalahan dalam data",
          validation_errors: errors,
          duplicate_student_ids: duplicateStudentIds,
          total_processed: jsonData.length,
          valid_count: validStudents.length,
        });
      }

      // If all data is valid, proceed with bulk insert
      const successfulInserts = [];
      const insertErrors = [];

      for (const studentData of validStudents) {
        try {
          const studentId = await Student.create(studentData);
          successfulInserts.push({
            id: studentId,
            ...studentData,
          });
        } catch (error) {
          insertErrors.push({
            student_id: studentData.student_id,
            error: error.message,
            data: studentData,
          });
        }
      }

      res.status(201).json({
        message: "Import data siswa selesai",
        summary: {
          total_processed: jsonData.length,
          successful_imports: successfulInserts.length,
          failed_imports: insertErrors.length,
        },
        successful_data: successfulInserts,
        failed_data: insertErrors,
      });
    } catch (error) {
      if (error.message.includes("diizinkan")) {
        return res.status(400).json({
          message: error.message,
        });
      }
      res.status(500).json({
        message: "Server error saat mengimport data",
        error: error.message,
      });
    }
  }
);

// EXPORT students to Excel - NEW ROUTE
router.get("/export/excel", authenticateToken, async (req, res) => {
  try {
    let students;

    if (req.user.role === "admin") {
      // Admin can export all students or filtered students
      const { class_id, grade_level, academic_year, gender } = req.query;

      if (class_id || grade_level || academic_year || gender) {
        students = await Student.getWithFilters({
          class_id: class_id ? parseInt(class_id) : null,
          grade_level: grade_level ? parseInt(grade_level) : null,
          academic_year,
          gender,
        });
      } else {
        students = await Student.getAll();
      }
    } else {
      // Non-admin can only export their class students
      students = await Student.getByClass(req.user.class_id);
    }

    // Format data for Excel
    const excelData = students.map((student) => ({
      NIS: student.student_id,
      "Nama Lengkap": student.full_name,
      "Nama Kelas": student.class_name,
      Tingkat: student.grade_level,
      "Tahun Ajaran": student.academic_year,
      "Jenis Kelamin": student.gender === "L" ? "Laki-laki" : "Perempuan",
      "Tanggal Lahir": student.birth_date,
      Alamat: student.address || "",
      "No. HP": student.phone || "",
      "No. HP Orang Tua": student.parent_phone || "",
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Siswa");

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Set headers for download
    const filename = `Data_Siswa_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.send(buffer);
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengexport data siswa",
      error: error.message,
    });
  }
});

// GET students by class ID - EXISTING ROUTE
router.get("/class/:classId", authenticateToken, async (req, res) => {
  try {
    const { classId } = req.params;

    if (!Number.isInteger(parseInt(classId))) {
      return res.status(400).json({ message: "ID kelas harus berupa angka" });
    }

    if (req.user.role !== "admin" && req.user.class_id != classId) {
      return res.status(403).json({
        message: "Anda tidak memiliki akses untuk melihat siswa kelas ini",
      });
    }

    const students = await Student.getByClass(classId);

    res.json({
      message: `Data siswa kelas berhasil diambil`,
      data: students,
      count: students.length,
      class_id: parseInt(classId),
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

// GET students by multiple classes - EXISTING ROUTE
router.get("/classes/:classIds", authenticateToken, async (req, res) => {
  try {
    const { classIds } = req.params;
    const classIdArray = classIds.split(",").map((id) => parseInt(id.trim()));

    const invalidIds = classIdArray.filter((id) => !Number.isInteger(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        message: "Semua ID kelas harus berupa angka",
        invalid_ids: invalidIds,
      });
    }

    if (req.user.role !== "admin") {
      const unauthorizedIds = classIdArray.filter(
        (id) => id !== req.user.class_id
      );
      if (unauthorizedIds.length > 0) {
        return res.status(403).json({
          message:
            "Anda tidak memiliki akses untuk melihat siswa dari kelas tersebut",
          unauthorized_class_ids: unauthorizedIds,
        });
      }
    }

    const students = await Student.getByMultipleClasses(classIdArray);

    res.json({
      message: `Data siswa dari ${classIdArray.length} kelas berhasil diambil`,
      data: students,
      count: students.length,
      class_ids: classIdArray,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

// GET students with advanced filtering - EXISTING ROUTE
router.get("/filter", authenticateToken, async (req, res) => {
  try {
    const { class_id, grade_level, academic_year, gender, search } = req.query;

    let students;

    if (req.user.role === "admin") {
      students = await Student.getWithFilters({
        class_id: class_id ? parseInt(class_id) : null,
        grade_level: grade_level ? parseInt(grade_level) : null,
        academic_year,
        gender,
        search,
      });
    } else {
      students = await Student.getWithFilters({
        class_id: req.user.class_id,
        grade_level: grade_level ? parseInt(grade_level) : null,
        academic_year,
        gender,
        search,
      });
    }

    res.json({
      message: "Data siswa dengan filter berhasil diambil",
      data: students,
      count: students.length,
      applied_filters: {
        class_id:
          req.user.role === "admin"
            ? class_id
              ? parseInt(class_id)
              : null
            : req.user.class_id,
        grade_level: grade_level ? parseInt(grade_level) : null,
        academic_year: academic_year || null,
        gender: gender || null,
        search: search || null,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

// GET student statistics by class - EXISTING ROUTE
router.get("/stats/class", authenticateToken, async (req, res) => {
  try {
    let stats;

    if (req.user.role === "admin") {
      stats = await Student.getStatsByClass();
    } else {
      stats = await Student.getStatsByClass(req.user.class_id);
    }

    res.json({
      message: "Statistik siswa per kelas berhasil diambil",
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

// GET student by ID - EXISTING ROUTE
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(parseInt(id))) {
      return res.status(400).json({ message: "ID harus berupa angka" });
    }

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({ message: "Siswa tidak ditemukan" });
    }

    if (req.user.role !== "admin" && student.class_id !== req.user.class_id) {
      return res.status(403).json({
        message: "Anda tidak memiliki akses untuk melihat data siswa ini",
      });
    }

    res.json({
      message: "Data siswa berhasil diambil",
      data: student,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

// CREATE new student - EXISTING ROUTE
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
        return res.status(400).json({
          message: "Data tidak valid",
          errors: errors.array(),
        });
      }

      const studentId = await Student.create(req.body);
      res.status(201).json({
        message: "Siswa berhasil ditambahkan",
        data: { id: studentId, ...req.body },
      });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ message: "NIS siswa sudah ada" });
      }
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// UPDATE student - EXISTING ROUTE
router.put(
  "/:id",
  authenticateToken,
  authorizeRole(["admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!Number.isInteger(parseInt(id))) {
        return res.status(400).json({ message: "ID harus berupa angka" });
      }

      const existingStudent = await Student.findById(id);
      if (!existingStudent) {
        return res.status(404).json({ message: "Siswa tidak ditemukan" });
      }

      const affectedRows = await Student.update(id, req.body);
      if (affectedRows === 0) {
        return res.status(400).json({ message: "Gagal mengupdate data siswa" });
      }

      res.json({
        message: "Data siswa berhasil diupdate",
        data: { id: parseInt(id), ...req.body },
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// DELETE student - EXISTING ROUTE
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole(["admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!Number.isInteger(parseInt(id))) {
        return res.status(400).json({ message: "ID harus berupa angka" });
      }

      const existingStudent = await Student.findById(id);
      if (!existingStudent) {
        return res.status(404).json({ message: "Siswa tidak ditemukan" });
      }

      const affectedRows = await Student.delete(id);
      if (affectedRows === 0) {
        return res.status(400).json({ message: "Gagal menghapus siswa" });
      }

      res.json({
        message: "Siswa berhasil dihapus",
        deleted_student: existingStudent,
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

module.exports = router;
