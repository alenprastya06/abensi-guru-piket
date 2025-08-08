const jwt = require("jsonwebtoken");
const db = require("../config/database");

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Token akses diperlukan" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [users] = await db.execute(
      "SELECT u.*, c.class_name FROM users u LEFT JOIN classes c ON u.class_id = c.id WHERE u.id = ?",
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(403).json({ message: "Token tidak valid" });
    }

    req.user = users[0];
    next();
  } catch (error) {
    return res.status(403).json({ message: "Token tidak valid" });
  }
};

const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Akses ditolak" });
    }
    next();
  };
};

module.exports = { authenticateToken, authorizeRole };
