const db = require("../config/database");
const bcrypt = require("bcrypt");

class User {
  static async findByUsername(username) {
    const [rows] = await db.execute(
      "SELECT u.*, c.class_name FROM users u LEFT JOIN classes c ON u.class_id = c.id WHERE u.username = ?",
      [username]
    );
    return rows[0];
  }

  static async create(userData) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const [result] = await db.execute(
      "INSERT INTO users (username, email, password, full_name, role, class_id) VALUES (?, ?, ?, ?, ?, ?)",
      [
        userData.username,
        userData.email,
        hashedPassword,
        userData.full_name,
        userData.role,
        userData.class_id,
      ]
    );
    return result.insertId;
  }

  static async getAllUsers() {
    const [rows] = await db.execute(
      "SELECT u.id, u.username, u.email, u.full_name, u.role, c.class_name FROM users u LEFT JOIN classes c ON u.class_id = c.id ORDER BY u.created_at DESC"
    );
    return rows;
  }

  static async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }
}

module.exports = User;
