const db = require("../config/database");

class Student {
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

  static async getByClass(classId) {
    const [rows] = await db.execute(
      "SELECT s.*, c.class_name FROM students s JOIN classes c ON s.class_id = c.id WHERE s.class_id = ? AND s.is_active = true ORDER BY s.full_name",
      [classId]
    );
    return rows;
  }

  static async getAll() {
    const [rows] = await db.execute(
      "SELECT s.*, c.class_name FROM students s JOIN classes c ON s.class_id = c.id WHERE s.is_active = true ORDER BY c.class_name, s.full_name"
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.execute(
      "SELECT s.*, c.class_name FROM students s JOIN classes c ON s.class_id = c.id WHERE s.id = ?",
      [id]
    );
    return rows[0];
  }

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

  static async delete(id) {
    const [result] = await db.execute(
      "UPDATE students SET is_active = false WHERE id = ?",
      [id]
    );
    return result.affectedRows;
  }
}

module.exports = Student;
