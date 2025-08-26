const db = require("../config/database");

class Student {
  // CREATE - Create new student
  static async create(studentData) {
    const [result] = await db.execute(
      "INSERT INTO students (student_id, full_name, class_id, gender, birth_date, address, phone, parent_phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        studentData.student_id,
        studentData.full_name,
        studentData.class_id,
        studentData.gender,
        studentData.birth_date,
        studentData.address,
        studentData.phone,
        studentData.parent_phone,
      ]
    );
    return result.insertId;
  }

  // READ - Get all students
  static async getAll() {
    const [rows] = await db.execute(
      `SELECT s.*, c.class_name, c.grade_level, c.academic_year 
       FROM students s 
       JOIN classes c ON s.class_id = c.id 
       WHERE s.is_active = true 
       ORDER BY c.grade_level, c.class_name, s.full_name`
    );
    return rows;
  }

  // READ - Get students by class ID
  static async getByClass(classId) {
    const [rows] = await db.execute(
      `SELECT s.*, c.class_name, c.grade_level, c.academic_year 
       FROM students s 
       JOIN classes c ON s.class_id = c.id 
       WHERE s.class_id = ? AND s.is_active = true 
       ORDER BY s.full_name`,
      [classId]
    );
    return rows;
  }

  // READ - Get students by multiple classes
  static async getByMultipleClasses(classIds) {
    const placeholders = classIds.map(() => "?").join(",");
    const [rows] = await db.execute(
      `SELECT s.*, c.class_name, c.grade_level, c.academic_year 
       FROM students s 
       JOIN classes c ON s.class_id = c.id 
       WHERE s.class_id IN (${placeholders}) AND s.is_active = true 
       ORDER BY c.grade_level, c.class_name, s.full_name`,
      classIds
    );
    return rows;
  }

  // READ - Get students with advanced filtering
  static async getWithFilters(filters) {
    let query = `
      SELECT s.*, c.class_name, c.grade_level, c.academic_year 
      FROM students s 
      JOIN classes c ON s.class_id = c.id 
      WHERE s.is_active = true
    `;
    let params = [];

    if (filters.class_id) {
      query += ` AND s.class_id = ?`;
      params.push(filters.class_id);
    }

    if (filters.grade_level) {
      query += ` AND c.grade_level = ?`;
      params.push(filters.grade_level);
    }

    if (filters.academic_year) {
      query += ` AND c.academic_year = ?`;
      params.push(filters.academic_year);
    }

    if (filters.gender) {
      query += ` AND s.gender = ?`;
      params.push(filters.gender);
    }

    if (filters.search) {
      query += ` AND (s.full_name LIKE ? OR s.student_id LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ` ORDER BY c.grade_level, c.class_name, s.full_name`;

    const [rows] = await db.execute(query, params);
    return rows;
  }

  // READ - Find student by ID
  static async findById(id) {
    const [rows] = await db.execute(
      `SELECT s.*, c.class_name, c.grade_level, c.academic_year 
       FROM students s 
       JOIN classes c ON s.class_id = c.id 
       WHERE s.id = ?`,
      [id]
    );
    return rows[0];
  }

  // READ - Search students by name or student ID
  static async search(searchTerm) {
    const [rows] = await db.execute(
      `SELECT s.*, c.class_name, c.grade_level, c.academic_year 
       FROM students s 
       JOIN classes c ON s.class_id = c.id 
       WHERE s.is_active = true 
       AND (s.full_name LIKE ? OR s.student_id LIKE ?) 
       ORDER BY c.grade_level, c.class_name, s.full_name`,
      [`%${searchTerm}%`, `%${searchTerm}%`]
    );
    return rows;
  }

  // READ - Get students by gender
  static async getByGender(gender) {
    const [rows] = await db.execute(
      `SELECT s.*, c.class_name, c.grade_level, c.academic_year 
       FROM students s 
       JOIN classes c ON s.class_id = c.id 
       WHERE s.gender = ? AND s.is_active = true 
       ORDER BY c.grade_level, c.class_name, s.full_name`,
      [gender]
    );
    return rows;
  }

  // READ - Get students by grade level
  static async getByGradeLevel(gradeLevel) {
    const [rows] = await db.execute(
      `SELECT s.*, c.class_name, c.grade_level, c.academic_year 
       FROM students s 
       JOIN classes c ON s.class_id = c.id 
       WHERE c.grade_level = ? AND s.is_active = true 
       ORDER BY c.class_name, s.full_name`,
      [gradeLevel]
    );
    return rows;
  }

  // READ - Get students by academic year
  static async getByAcademicYear(academicYear) {
    const [rows] = await db.execute(
      `SELECT s.*, c.class_name, c.grade_level, c.academic_year 
       FROM students s 
       JOIN classes c ON s.class_id = c.id 
       WHERE c.academic_year = ? AND s.is_active = true 
       ORDER BY c.grade_level, c.class_name, s.full_name`,
      [academicYear]
    );
    return rows;
  }

  // UPDATE - Update student by ID
  static async update(id, studentData) {
    const [result] = await db.execute(
      "UPDATE students SET full_name = ?, gender = ?, birth_date = ?, address = ?, phone = ?, parent_phone = ? WHERE id = ?",
      [
        studentData.full_name,
        studentData.gender,
        studentData.birth_date,
        studentData.address,
        studentData.phone,
        studentData.parent_phone,
        id,
      ]
    );
    return result.affectedRows;
  }

  // UPDATE - Update student class
  static async updateClass(id, newClassId) {
    const [result] = await db.execute(
      "UPDATE students SET class_id = ? WHERE id = ?",
      [newClassId, id]
    );
    return result.affectedRows;
  }

  // UPDATE - Bulk update students' class
  static async bulkUpdateClass(studentIds, newClassId) {
    const placeholders = studentIds.map(() => "?").join(",");
    const [result] = await db.execute(
      `UPDATE students SET class_id = ? WHERE id IN (${placeholders})`,
      [newClassId, ...studentIds]
    );
    return result.affectedRows;
  }

  // DELETE - Soft delete student by ID
  static async delete(id) {
    const [result] = await db.execute(
      "UPDATE students SET is_active = false WHERE id = ?",
      [id]
    );
    return result.affectedRows;
  }

  // DELETE - Bulk soft delete students
  static async bulkDelete(studentIds) {
    const placeholders = studentIds.map(() => "?").join(",");
    const [result] = await db.execute(
      `UPDATE students SET is_active = false WHERE id IN (${placeholders})`,
      studentIds
    );
    return result.affectedRows;
  }

  // STATISTICS - Get student count by class
  static async getStatsByClass(specificClassId = null) {
    let query = `
      SELECT 
        c.id as class_id,
        c.class_name,
        c.grade_level,
        c.academic_year,
        COUNT(s.id) as total_students,
        SUM(CASE WHEN s.gender = 'L' THEN 1 ELSE 0 END) as male_count,
        SUM(CASE WHEN s.gender = 'P' THEN 1 ELSE 0 END) as female_count
      FROM classes c
      LEFT JOIN students s ON c.id = s.class_id AND s.is_active = true
    `;

    let params = [];

    if (specificClassId) {
      query += ` WHERE c.id = ?`;
      params.push(specificClassId);
    }

    query += ` GROUP BY c.id, c.class_name, c.grade_level, c.academic_year ORDER BY c.grade_level, c.class_name`;

    const [rows] = await db.execute(query, params);
    return rows;
  }

  // STATISTICS - Get student count by grade level
  static async getStatsByGradeLevel() {
    const [rows] = await db.execute(
      `SELECT 
        c.grade_level,
        COUNT(s.id) as total_students,
        SUM(CASE WHEN s.gender = 'L' THEN 1 ELSE 0 END) as male_count,
        SUM(CASE WHEN s.gender = 'P' THEN 1 ELSE 0 END) as female_count,
        COUNT(DISTINCT c.id) as total_classes
       FROM classes c
       LEFT JOIN students s ON c.id = s.class_id AND s.is_active = true
       GROUP BY c.grade_level 
       ORDER BY c.grade_level`
    );
    return rows;
  }

  // STATISTICS - Get total student count
  static async getTotalCount() {
    const [rows] = await db.execute(
      "SELECT COUNT(*) as count FROM students WHERE is_active = true"
    );
    return rows[0].count;
  }

  // STATISTICS - Get student count by gender
  static async getCountByGender() {
    const [rows] = await db.execute(
      `SELECT 
        gender,
        COUNT(*) as count 
       FROM students 
       WHERE is_active = true 
       GROUP BY gender`
    );
    return rows;
  }

  // UTILITY - Check if student exists
  static async exists(id) {
    const [rows] = await db.execute(
      "SELECT COUNT(*) as count FROM students WHERE id = ? AND is_active = true",
      [id]
    );
    return rows[0].count > 0;
  }

  // UTILITY - Check if student ID exists
  static async existsByStudentId(studentId, excludeId = null) {
    let query =
      "SELECT COUNT(*) as count FROM students WHERE student_id = ? AND is_active = true";
    let params = [studentId];

    if (excludeId) {
      query += " AND id != ?";
      params.push(excludeId);
    }

    const [rows] = await db.execute(query, params);
    return rows[0].count > 0;
  }

  // UTILITY - Get students count by class (quick count)
  static async getCountByClass(classId) {
    const [rows] = await db.execute(
      "SELECT COUNT(*) as count FROM students WHERE class_id = ? AND is_active = true",
      [classId]
    );
    return rows[0].count;
  }

  // UTILITY - Check if any students exist in class
  static async hasStudentsInClass(classId) {
    const [rows] = await db.execute(
      "SELECT COUNT(*) as count FROM students WHERE class_id = ? AND is_active = true",
      [classId]
    );
    return rows[0].count > 0;
  }
}

module.exports = Student;
