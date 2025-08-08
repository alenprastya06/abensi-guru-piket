const db = require("../config/database");

class Class {
  static async getAll() {
    const [rows] = await db.execute(
      "SELECT * FROM classes ORDER BY grade_level, class_name"
    );
    return rows;
  }

  static async create(classData) {
    const [result] = await db.execute(
      "INSERT INTO classes (class_name, grade_level, academic_year) VALUES (?, ?, ?)",
      [classData.class_name, classData.grade_level, classData.academic_year]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.execute("SELECT * FROM classes WHERE id = ?", [id]);
    return rows[0];
  }
}

module.exports = Class;
