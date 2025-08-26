const express = require("express");
const Class = require("../models/Class");
const { authenticateToken, authorizeRole } = require("../middleware/auth");
const router = express.Router();

// Validation middleware
const validateClassData = (req, res, next) => {
  const { class_name, grade_level, academic_year } = req.body;

  if (!class_name || !grade_level || !academic_year) {
    return res.status(400).json({
      message: "Semua field wajib diisi",
      required: ["class_name", "grade_level", "academic_year"],
    });
  }

  if (typeof class_name !== "string" || class_name.trim() === "") {
    return res.status(400).json({
      message: "Nama kelas harus berupa string yang tidak kosong",
    });
  }

  if (!Number.isInteger(grade_level) || grade_level < 1 || grade_level > 12) {
    return res.status(400).json({
      message: "Tingkat kelas harus berupa angka antara 1-12",
    });
  }

  next();
};

// READ - Get all classes
router.get("/", authenticateToken, async (req, res) => {
  try {
    const classes = await Class.getAll();
    res.json({
      message: "Data kelas berhasil diambil",
      data: classes,
      count: classes.length,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

// READ - Get class by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(parseInt(id))) {
      return res.status(400).json({ message: "ID harus berupa angka" });
    }

    const classData = await Class.findById(id);

    if (!classData) {
      return res.status(404).json({ message: "Kelas tidak ditemukan" });
    }

    res.json({
      message: "Data kelas berhasil diambil",
      data: classData,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

// READ - Get classes by grade level
router.get("/grade/:gradeLevel", authenticateToken, async (req, res) => {
  try {
    const { gradeLevel } = req.params;

    if (!Number.isInteger(parseInt(gradeLevel))) {
      return res
        .status(400)
        .json({ message: "Tingkat kelas harus berupa angka" });
    }

    const classes = await Class.findByGradeLevel(gradeLevel);

    res.json({
      message: `Data kelas tingkat ${gradeLevel} berhasil diambil`,
      data: classes,
      count: classes.length,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

// READ - Get classes by academic year
router.get("/year/:academicYear", authenticateToken, async (req, res) => {
  try {
    const { academicYear } = req.params;
    const classes = await Class.findByAcademicYear(academicYear);

    res.json({
      message: `Data kelas tahun ajaran ${academicYear} berhasil diambil`,
      data: classes,
      count: classes.length,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

// READ - Search classes by name
router.get("/search/:className", authenticateToken, async (req, res) => {
  try {
    const { className } = req.params;
    const classes = await Class.searchByName(className);

    res.json({
      message: `Hasil pencarian untuk "${className}"`,
      data: classes,
      count: classes.length,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

// READ - Get statistics
router.get("/stats/overview", authenticateToken, async (req, res) => {
  try {
    const totalCount = await Class.getTotalCount();
    const countByGrade = await Class.getCountByGradeLevel();

    res.json({
      message: "Statistik kelas berhasil diambil",
      data: {
        total_classes: totalCount,
        by_grade_level: countByGrade,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

// CREATE - Create new class
router.post(
  "/",
  authenticateToken,
  authorizeRole(["admin"]),
  validateClassData,
  async (req, res) => {
    try {
      const { class_name, grade_level, academic_year } = req.body;

      // Check if class already exists
      const exists = await Class.existsByNameAndGrade(
        class_name,
        grade_level,
        academic_year
      );
      if (exists) {
        return res.status(409).json({
          message:
            "Kelas dengan nama, tingkat, dan tahun ajaran yang sama sudah ada",
        });
      }

      const classId = await Class.create(req.body);
      res.status(201).json({
        message: "Kelas berhasil ditambahkan",
        data: { id: classId, ...req.body },
      });
    } catch (error) {
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

// UPDATE - Update class by ID
router.put(
  "/:id",
  authenticateToken,
  authorizeRole(["admin"]),
  validateClassData,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { class_name, grade_level, academic_year } = req.body;

      if (!Number.isInteger(parseInt(id))) {
        return res.status(400).json({ message: "ID harus berupa angka" });
      }

      // Check if class exists
      const existingClass = await Class.findById(id);
      if (!existingClass) {
        return res.status(404).json({ message: "Kelas tidak ditemukan" });
      }

      // Check if updated name conflicts with existing classes (exclude current class)
      const nameExists = await Class.existsByNameAndGrade(
        class_name,
        grade_level,
        academic_year,
        id
      );
      if (nameExists) {
        return res.status(409).json({
          message:
            "Kelas dengan nama, tingkat, dan tahun ajaran yang sama sudah ada",
        });
      }

      const updated = await Class.update(id, req.body);

      if (updated) {
        res.json({
          message: "Kelas berhasil diperbarui",
          data: { id: parseInt(id), ...req.body },
        });
      } else {
        res.status(400).json({ message: "Gagal memperbarui kelas" });
      }
    } catch (error) {
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

// UPDATE - Partially update class
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole(["admin"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!Number.isInteger(parseInt(id))) {
        return res.status(400).json({ message: "ID harus berupa angka" });
      }

      if (Object.keys(updates).length === 0) {
        return res
          .status(400)
          .json({ message: "Tidak ada data yang akan diperbarui" });
      }

      // Check if class exists
      const existingClass = await Class.findById(id);
      if (!existingClass) {
        return res.status(404).json({ message: "Kelas tidak ditemukan" });
      }

      // Validate fields if they exist
      const allowedFields = ["class_name", "grade_level", "academic_year"];
      const invalidFields = Object.keys(updates).filter(
        (field) => !allowedFields.includes(field)
      );

      if (invalidFields.length > 0) {
        return res.status(400).json({
          message: "Field tidak valid",
          invalid_fields: invalidFields,
          allowed_fields: allowedFields,
        });
      }

      // Validate specific field types
      if (
        updates.class_name !== undefined &&
        (typeof updates.class_name !== "string" ||
          updates.class_name.trim() === "")
      ) {
        return res.status(400).json({
          message: "Nama kelas harus berupa string yang tidak kosong",
        });
      }

      if (
        updates.grade_level !== undefined &&
        (!Number.isInteger(updates.grade_level) ||
          updates.grade_level < 1 ||
          updates.grade_level > 12)
      ) {
        return res
          .status(400)
          .json({ message: "Tingkat kelas harus berupa angka antara 1-12" });
      }

      // Check for name conflicts if name, grade, or year is being updated
      if (updates.class_name || updates.grade_level || updates.academic_year) {
        const newClassName = updates.class_name || existingClass.class_name;
        const newGradeLevel = updates.grade_level || existingClass.grade_level;
        const newAcademicYear =
          updates.academic_year || existingClass.academic_year;

        const nameExists = await Class.existsByNameAndGrade(
          newClassName,
          newGradeLevel,
          newAcademicYear,
          id
        );
        if (nameExists) {
          return res.status(409).json({
            message:
              "Kelas dengan nama, tingkat, dan tahun ajaran yang sama sudah ada",
          });
        }
      }

      const updated = await Class.updateFields(id, updates);

      if (updated) {
        const updatedClass = await Class.findById(id);
        res.json({
          message: "Kelas berhasil diperbarui",
          data: updatedClass,
        });
      } else {
        res.status(400).json({ message: "Gagal memperbarui kelas" });
      }
    } catch (error) {
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

// DELETE - Delete class by ID
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

      // Check if class exists
      const existingClass = await Class.findById(id);
      if (!existingClass) {
        return res.status(404).json({ message: "Kelas tidak ditemukan" });
      }

      const deleted = await Class.delete(id);

      if (deleted) {
        res.json({
          message: "Kelas berhasil dihapus",
          deleted_class: existingClass,
        });
      } else {
        res.status(400).json({ message: "Gagal menghapus kelas" });
      }
    } catch (error) {
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

// DELETE - Delete classes by grade level (bulk delete)
router.delete(
  "/grade/:gradeLevel",
  authenticateToken,
  authorizeRole(["admin"]),
  async (req, res) => {
    try {
      const { gradeLevel } = req.params;

      if (!Number.isInteger(parseInt(gradeLevel))) {
        return res
          .status(400)
          .json({ message: "Tingkat kelas harus berupa angka" });
      }

      // Get classes that will be deleted
      const classesToDelete = await Class.findByGradeLevel(gradeLevel);

      if (classesToDelete.length === 0) {
        return res.status(404).json({
          message: `Tidak ada kelas di tingkat ${gradeLevel}`,
        });
      }

      const deletedCount = await Class.deleteByGradeLevel(gradeLevel);

      res.json({
        message: `${deletedCount} kelas tingkat ${gradeLevel} berhasil dihapus`,
        deleted_count: deletedCount,
        deleted_classes: classesToDelete,
      });
    } catch (error) {
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  }
);

module.exports = router;
