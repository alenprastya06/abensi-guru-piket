const db = require("../config/database");

class Class {
  // READ - Get all classes
  static async getAll() {
    const [rows] = await db.execute(
      "SELECT * FROM classes ORDER BY grade_level, class_name"
    );
    return rows;
  }

  // READ - Find class by ID
  static async findById(id) {
    const [rows] = await db.execute("SELECT * FROM classes WHERE id = ?", [id]);
    return rows[0];
  }

  // READ - Find classes by grade level
  static async findByGradeLevel(gradeLevel) {
    const [rows] = await db.execute(
      "SELECT * FROM classes WHERE grade_level = ? ORDER BY class_name",
      [gradeLevel]
    );
    return rows;
  }

  // READ - Find classes by academic year
  static async findByAcademicYear(academicYear) {
    const [rows] = await db.execute(
      "SELECT * FROM classes WHERE academic_year = ? ORDER BY grade_level, class_name",
      [academicYear]
    );
    return rows;
  }

  // READ - Search classes by name
  static async searchByName(className) {
    const [rows] = await db.execute(
      "SELECT * FROM classes WHERE class_name LIKE ? ORDER BY grade_level, class_name",
      [`%${className}%`]
    );
    return rows;
  }

  // CREATE - Create new class
  static async create(classData) {
    const [result] = await db.execute(
      "INSERT INTO classes (class_name, grade_level, academic_year) VALUES (?, ?, ?)",
      [classData.class_name, classData.grade_level, classData.academic_year]
    );
    return result.insertId;
  }

  // UPDATE - Update class by ID
  static async update(id, classData) {
    const [result] = await db.execute(
      "UPDATE classes SET class_name = ?, grade_level = ?, academic_year = ? WHERE id = ?",
      [classData.class_name, classData.grade_level, classData.academic_year, id]
    );
    return result.affectedRows > 0;
  }

  // UPDATE - Update specific fields
  static async updateFields(id, fields) {
    const setClause = Object.keys(fields)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = [...Object.values(fields), id];

    const [result] = await db.execute(
      `UPDATE classes SET ${setClause} WHERE id = ?`,
      values
    );
    return result.affectedRows > 0;
  }

  // DELETE - Delete class by ID
  static async delete(id) {
    const [result] = await db.execute("DELETE FROM classes WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }

  // DELETE - Delete classes by grade level
  static async deleteByGradeLevel(gradeLevel) {
    const [result] = await db.execute(
      "DELETE FROM classes WHERE grade_level = ?",
      [gradeLevel]
    );
    return result.affectedRows;
  }

  // UTILITY - Check if class exists
  static async exists(id) {
    const [rows] = await db.execute(
      "SELECT COUNT(*) as count FROM classes WHERE id = ?",
      [id]
    );
    return rows[0].count > 0;
  }

  // UTILITY - Check if class name exists in same grade and academic year
  static async existsByNameAndGrade(
    className,
    gradeLevel,
    academicYear,
    excludeId = null
  ) {
    let query =
      "SELECT COUNT(*) as count FROM classes WHERE class_name = ? AND grade_level = ? AND academic_year = ?";
    let params = [className, gradeLevel, academicYear];

    if (excludeId) {
      query += " AND id != ?";
      params.push(excludeId);
    }

    const [rows] = await db.execute(query, params);
    return rows[0].count > 0;
  }

  // UTILITY - Get classes count by grade level
  static async getCountByGradeLevel() {
    const [rows] = await db.execute(
      "SELECT grade_level, COUNT(*) as count FROM classes GROUP BY grade_level ORDER BY grade_level"
    );
    return rows;
  }

  // UTILITY - Get total classes count
  static async getTotalCount() {
    const [rows] = await db.execute("SELECT COUNT(*) as count FROM classes");
    return rows[0].count;
  }
}

module.exports = Class;
