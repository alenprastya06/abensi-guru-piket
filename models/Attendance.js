const db = require("../config/database");
const moment = require("moment");

class Attendance {
  static async create(attendanceData) {
    const [result] = await db.execute(
      "INSERT INTO attendances (student_id, attendance_date, status, notes, recorded_by) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), notes = VALUES(notes), recorded_by = VALUES(recorded_by)",
      [
        attendanceData.student_id,
        attendanceData.attendance_date,
        attendanceData.status,
        attendanceData.notes,
        attendanceData.recorded_by,
      ]
    );
    return result.insertId || result.affectedRows;
  }

  static async getClassNameById(classId) {
    const [rows] = await db.execute(
      "SELECT class_name FROM classes WHERE id = ?",
      [classId]
    );
    return rows.length > 0 ? rows[0].class_name : `Kelas ${classId}`;
  }

  // Metode getByClassAndDate diperbaiki
  static async getByClassAndDate(classId, date) {
    const [rows] = await db.execute(
      `
      SELECT s.id as student_id, s.full_name, s.student_id as nis, 
             c.class_name, a.status, a.notes, a.id as attendance_id
      FROM students s 
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN attendances a ON s.id = a.student_id AND a.attendance_date = ?
      WHERE s.class_id = ? AND s.is_active = true
      ORDER BY s.full_name
    `,
      [date, classId]
    );
    return rows;
  }

  // Metode getByDateRange diperbaiki
  static async getByDateRange(startDate, endDate, classId = null) {
    let query = `
      SELECT a.*, s.full_name, s.student_id as nis, c.class_name, u.full_name as recorded_by_name
      FROM attendances a
      JOIN students s ON a.student_id = s.id
      JOIN classes c ON s.class_id = c.id
      JOIN users u ON a.recorded_by = u.id
      WHERE a.attendance_date BETWEEN ? AND ?
    `;
    const params = [startDate, endDate];

    if (classId) {
      query += " AND s.class_id = ?";
      params.push(classId);
    }

    query += " ORDER BY a.attendance_date DESC, c.class_name, s.full_name";

    const [rows] = await db.execute(query, params);
    return rows;
  }

  // Metode getAttendanceReport diperbaiki
  static async getAttendanceReport(classId, month, year) {
    const [rows] = await db.execute(
      `
      SELECT s.id, s.full_name, s.student_id as nis, c.class_name,
             COUNT(CASE WHEN a.status = 'hadir' THEN 1 END) as hadir,
             COUNT(CASE WHEN a.status = 'sakit' THEN 1 END) as sakit,
             COUNT(CASE WHEN a.status = 'ijin' THEN 1 END) as ijin,
             COUNT(CASE WHEN a.status = 'alfa' THEN 1 END) as alfa,
             COUNT(a.id) as total_recorded
      FROM students s
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN attendances a ON s.id = a.student_id 
        AND MONTH(a.attendance_date) = ? 
        AND YEAR(a.attendance_date) = ?
      WHERE s.class_id = ? AND s.is_active = true
      GROUP BY s.id, s.full_name, s.student_id, c.class_name
      ORDER BY s.full_name
    `,
      [month, year, classId]
    );
    return rows;
  }

  // Metode getAttendanceReportByMonthRange diperbaiki
  static async getAttendanceReportByMonthRange(
    classId,
    startMonth,
    startYear,
    endMonth,
    endYear
  ) {
    let startMonthInt = parseInt(startMonth);
    let startYearInt = parseInt(startYear);
    let endMonthInt = parseInt(endMonth);
    let endYearInt = parseInt(endYear);

    const startDate = `${startYearInt}-${startMonthInt
      .toString()
      .padStart(2, "0")}-01`;
    const endDate = moment(
      `${endYearInt}-${endMonthInt.toString().padStart(2, "0")}-01`
    )
      .endOf("month")
      .format("YYYY-MM-DD");

    const [rows] = await db.execute(
      `
    SELECT 
      s.id, 
      s.full_name, 
      s.student_id as nis, 
      c.class_name,
      SUM(CASE WHEN a.status = 'hadir' THEN 1 ELSE 0 END) as hadir,
      SUM(CASE WHEN a.status = 'sakit' THEN 1 ELSE 0 END) as sakit,
      SUM(CASE WHEN a.status = 'ijin' THEN 1 ELSE 0 END) as ijin,
      SUM(CASE WHEN a.status = 'alfa' THEN 1 ELSE 0 END) as alfa,
      COUNT(a.id) as total_recorded
    FROM students s
    JOIN classes c ON s.class_id = c.id
    LEFT JOIN attendances a ON s.id = a.student_id 
      AND a.attendance_date BETWEEN ? AND ?
    WHERE s.class_id = ? AND s.is_active = true
    GROUP BY s.id, s.full_name, s.student_id, c.class_name
    ORDER BY s.full_name
    `,
      [startDate, endDate, classId]
    );

    return rows;
  }

  // Metode getDetailedAttendanceReportByMonthRange diperbaiki
  static async getDetailedAttendanceReportByMonthRange(
    classId,
    startMonth,
    startYear,
    endMonth,
    endYear
  ) {
    let startMonthInt = parseInt(startMonth);
    let startYearInt = parseInt(startYear);
    let endMonthInt = parseInt(endMonth);
    let endYearInt = parseInt(endYear);

    const [rows] = await db.execute(
      `
      SELECT s.id, s.full_name, s.student_id as nis, c.class_name,
             YEAR(a.attendance_date) as year,
             MONTH(a.attendance_date) as month,
             MONTHNAME(a.attendance_date) as month_name,
             COUNT(CASE WHEN a.status = 'hadir' THEN 1 END) as hadir,
             COUNT(CASE WHEN a.status = 'sakit' THEN 1 END) as sakit,
             COUNT(CASE WHEN a.status = 'ijin' THEN 1 END) as ijin,
             COUNT(CASE WHEN a.status = 'alfa' THEN 1 END) as alfa,
             COUNT(a.id) as total_recorded
      FROM students s
      JOIN classes c ON s.class_id = c.id
      LEFT JOIN attendances a ON s.id = a.student_id 
        AND (
          (YEAR(a.attendance_date) = ? AND MONTH(a.attendance_date) >= ?) OR
          (YEAR(a.attendance_date) > ? AND YEAR(a.attendance_date) < ?) OR
          (YEAR(a.attendance_date) = ? AND MONTH(a.attendance_date) <= ?)
        )
      WHERE s.class_id = ? AND s.is_active = true
      GROUP BY s.id, s.full_name, s.student_id, c.class_name, YEAR(a.attendance_date), MONTH(a.attendance_date)
      ORDER BY s.full_name, year, month
    `,
      [
        startYearInt,
        startMonthInt,
        startYearInt,
        endYearInt,
        endYearInt,
        endMonthInt,
        classId,
      ]
    );

    const studentData = {};
    rows.forEach((row) => {
      if (!studentData[row.id]) {
        studentData[row.id] = {
          id: row.id,
          full_name: row.full_name,
          nis: row.nis,
          class_name: row.class_name,
          months: [],
          totals: { hadir: 0, sakit: 0, ijin: 0, alfa: 0, total_recorded: 0 },
        };
      }

      if (row.year) {
        studentData[row.id].months.push({
          year: row.year,
          month: row.month,
          month_name: row.month_name,
          hadir: row.hadir,
          sakit: row.sakit,
          ijin: row.ijin,
          alfa: row.alfa,
          total_recorded: row.total_recorded,
        });

        studentData[row.id].totals.hadir += row.hadir;
        studentData[row.id].totals.sakit += row.sakit;
        studentData[row.id].totals.ijin += row.ijin;
        studentData[row.id].totals.alfa += row.alfa;
        studentData[row.id].totals.total_recorded += row.total_recorded;
      }
    });

    return Object.values(studentData);
  }

  // Metode getAllStudentsWithClass diperbaiki
  static async getAllStudentsWithClass() {
    const [rows] = await db.execute(
      `
      SELECT s.id, s.student_id as nis, s.full_name, c.class_name, s.class_id,
             s.gender, s.birth_date, s.address, s.phone, s.parent_phone, s.is_active
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE s.is_active = true
      ORDER BY c.class_name, s.full_name
      `
    );
    return rows;
  }

  // Metode getStudentsByClassName diperbaiki
  static async getStudentsByClassName(className) {
    const [rows] = await db.execute(
      `
      SELECT s.id, s.student_id as nis, s.full_name, c.class_name, s.class_id,
             s.gender, s.birth_date, s.address, s.phone, s.parent_phone, s.is_active
      FROM students s
      JOIN classes c ON s.class_id = c.id
      WHERE c.class_name = ? AND s.is_active = true
      ORDER BY s.full_name
      `,
      [className]
    );
    return rows;
  }
}

module.exports = Attendance;
