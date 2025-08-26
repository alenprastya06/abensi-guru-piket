const express = require("express");
const { body, validationResult } = require("express-validator");
const moment = require("moment");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const Class = require("../models/Class");
const { authenticateToken, authorizeRole } = require("../middleware/auth");
const router = express.Router();
const ExcelJS = require("exceljs");

router.get("/date/:date", authenticateToken, async (req, res) => {
  try {
    const { date } = req.params;
    let classId = req.query.class_id;
    if (req.user.role === "secretary") {
      classId = req.user.class_id;
    }

    if (!classId) {
      return res.status(400).json({ message: "Class ID diperlukan" });
    }

    const attendances = await Attendance.getByClassAndDate(classId, date);
    res.json(attendances);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post(
  "/",
  authenticateToken,
  [
    body("attendances")
      .isArray()
      .withMessage("Data absensi harus berupa array"),
    body("attendances.*.student_id")
      .isInt()
      .withMessage("Student ID harus berupa angka"),
    body("attendances.*.status")
      .isIn(["hadir", "sakit", "ijin", "alfa"])
      .withMessage("Status tidak valid"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { attendances, attendance_date } = req.body;
      const date = attendance_date || moment().format("YYYY-MM-DD");

      // Verify students belong to user's class (for secretary)
      if (req.user.role === "secretary") {
        for (const attendance of attendances) {
          const student = await Student.findById(attendance.student_id);
          if (!student || student.class_id !== req.user.class_id) {
            return res.status(403).json({
              message: "Tidak dapat mencatat absensi siswa dari kelas lain",
            });
          }
        }
      }

      const results = [];
      for (const attendance of attendances) {
        const result = await Attendance.create({
          student_id: attendance.student_id,
          attendance_date: date,
          status: attendance.status,
          notes: attendance.notes || null,
          recorded_by: req.user.id,
        });
        results.push(result);
      }

      res.json({ message: "Absensi berhasil dicatat", results });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// Get attendance report (no change here, this is for display data, not download)
router.get("/report", authenticateToken, async (req, res) => {
  try {
    const {
      start_date,
      end_date,
      class_id,
      month,
      year,
      start_month,
      start_year,
      end_month,
      end_year,
      detailed,
    } = req.query;

    // Month range report
    if (start_month && start_year && end_month && end_year && class_id) {
      let targetClassId = class_id;
      if (req.user.role === "secretary") {
        targetClassId = req.user.class_id;
      }

      const startMonthInt = parseInt(start_month);
      const startYearInt = parseInt(start_year);
      const endMonthInt = parseInt(end_month);
      const endYearInt = parseInt(end_year);

      // Validation
      if (
        startMonthInt < 1 ||
        startMonthInt > 12 ||
        endMonthInt < 1 ||
        endMonthInt > 12
      ) {
        return res.status(400).json({ message: "Bulan harus antara 1-12" });
      }

      if (
        startYearInt > endYearInt ||
        (startYearInt === endYearInt && startMonthInt > endMonthInt)
      ) {
        return res.status(400).json({
          message: "Periode mulai tidak boleh lebih besar dari periode akhir",
        });
      }

      let report;
      if (detailed === "true") {
        report = await Attendance.getDetailedAttendanceReportByMonthRange(
          targetClassId,
          startMonthInt,
          startYearInt,
          endMonthInt,
          endYearInt
        );
      } else {
        report = await Attendance.getAttendanceReportByMonthRange(
          targetClassId,
          startMonthInt,
          startYearInt,
          endMonthInt,
          endYearInt
        );
      }

      res.json({
        period: {
          start: `${startYearInt}-${startMonthInt.toString().padStart(2, "0")}`,
          end: `${endYearInt}-${endMonthInt.toString().padStart(2, "0")}`,
          start_month: startMonthInt,
          start_year: startYearInt,
          end_month: endMonthInt,
          end_year: endYearInt,
        },
        data: report,
      });
    }
    // Single month report
    else if (month && year && class_id) {
      let targetClassId = class_id;
      if (req.user.role === "secretary") {
        targetClassId = req.user.class_id;
      }

      const report = await Attendance.getAttendanceReport(
        targetClassId,
        month,
        year
      );
      res.json(report);
    }
    // Date range report
    else if (start_date && end_date) {
      let targetClassId = null;
      if (req.user.role === "secretary") {
        targetClassId = req.user.class_id;
      } else if (class_id) {
        targetClassId = class_id;
      }

      const report = await Attendance.getByDateRange(
        start_date,
        end_date,
        targetClassId
      );
      res.json(report);
    } else {
      res.status(400).json({
        message:
          "Parameter tidak lengkap. Gunakan salah satu: " +
          "(start_date & end_date), " +
          "(month & year & class_id), " +
          "(start_month & start_year & end_month & end_year & class_id)",
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

async function generateExcel(
  data,
  fields,
  sheetName = "Sheet1",
  reportTitle = "",
  reportPeriod = ""
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  let currentRow = 1;

  // Add dynamic title if provided
  if (reportTitle) {
    worksheet.mergeCells(
      `A${currentRow}:${String.fromCharCode(
        65 + fields.length - 1
      )}${currentRow}`
    );
    worksheet.getCell(`A${currentRow}`).value = reportTitle;
    worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 16 };
    worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
    currentRow++;
  }

  // Add dynamic period info if provided
  if (reportPeriod) {
    worksheet.mergeCells(
      `A${currentRow}:${String.fromCharCode(
        65 + fields.length - 1
      )}${currentRow}`
    );
    worksheet.getCell(`A${currentRow}`).value = reportPeriod;
    worksheet.getCell(`A${currentRow}`).font = { bold: false, size: 12 };
    worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
    currentRow++;
  }

  // Add an empty row for spacing
  if (reportTitle || reportPeriod) {
    currentRow++;
  }

  // Set up columns with proper headers
  worksheet.columns = fields.map((field) => ({
    header: field.label,
    key: field.value,
    width: field.width || 15,
  }));

  // Set header row number for styling
  const headerRowNumber = currentRow;
  worksheet.getRow(headerRowNumber).values = fields.map((field) => field.label);

  // Add data rows
  worksheet.addRows(data);

  // Style headers with dark background
  worksheet.getRow(headerRowNumber).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; // White text
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF404040" }, // Dark gray background
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    };
  });

  // Style data rows with alternating colors
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > headerRowNumber) {
      const isEvenRow = (rowNumber - headerRowNumber) % 2 === 0;

      row.eachCell((cell, colNumber) => {
        // Alternating row colors
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEvenRow ? "FFF5F5F5" : "FFFFFFFF" }, // Light gray for even rows
        };

        cell.border = {
          top: { style: "thin", color: { argb: "FFD3D3D3" } },
          left: { style: "thin", color: { argb: "FFD3D3D3" } },
          bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
          right: { style: "thin", color: { argb: "FFD3D3D3" } },
        };

        cell.alignment = { horizontal: "center", vertical: "middle" };

        // Special formatting for percentage column
        const field = fields[colNumber - 1];
        if (field && field.value === "percentage") {
          cell.numFmt = "0.0%";
        }
      });
    }
  });

  return await workbook.xlsx.writeBuffer();
}

router.get(
  "/download/daily/:date",
  authenticateToken,
  authorizeRole(["admin", "secretary"]), // Adjust roles as needed
  async (req, res) => {
    try {
      const { date } = req.params;
      let classId = req.query.class_id;

      if (req.user.role === "secretary") {
        classId = req.user.class_id;
      }

      if (!classId) {
        return res.status(400).json({ message: "Class ID is required" });
      }
       const classData = await Class.findById(classId);
      if (!classData) {
        return res
          .status(404)
          .json({ message: `Class with ID ${classId} not found` });
      }
      const className = classData.class_name;
      const attendances = await Attendance.getByClassAndDate(classId, date);

      if (attendances.length === 0) {
        return res.status(404).json({
          message: `No attendance data found for class ${classId} on ${date}`,
        });
      }

      // Prepare data for Excel
      const fields = [
        { label: "Tanggal Absensi", value: "attendance_date", width: 20 }, // Added Tanggal Absensi
        { label: "NIS", value: "nis", width: 15 },
        { label: "Nama Lengkap", value: "full_name", width: 30 },
        { label: "Status", value: "status", width: 15 },
        { label: "Catatan", value: "notes", width: 40 },
        { label: "Dicatat Oleh", value: "recorded_by_name", width: 25 }, // Added Dicatat Oleh
      ];

      // Fetch full details for daily report to include class_name and recorded_by_name
      // Re-fetch using getByDateRange for comprehensive data
      const fullDailyReport = await Attendance.getByDateRange(
        date,
        date,
        classId
      );

      const reportTitle = `Laporan Absensi Harian Kelas ${className}`;
      const reportPeriod = `Tanggal: ${moment(date).format("DD MMMM YYYY")}`;

      const excelBuffer = await generateExcel(
        fullDailyReport,
        fields,
        `Absensi Harian ${date}`,
        reportTitle,
        reportPeriod
      );

      res.header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.attachment(`Laporan_Absensi_Harian_${className}_${date}.xlsx`);
      return res.send(excelBuffer);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

function createAttendanceSummary(rawData) {
  const summary = {};

  rawData.forEach((record) => {
    const key = `${record.student_id || record.nis}_${record.full_name}`;

    if (!summary[key]) {
      summary[key] = {
        nis: record.nis,
        full_name: record.full_name,
        class_name: record.class_name,
        hadir: 0,
        sakit: 0,
        ijin: 0,
        alfa: 0,
        total_records: 0,
      };
    }

    switch (record.status) {
      case "hadir":
        summary[key].hadir++;
        break;
      case "sakit":
        summary[key].sakit++;
        break;
      case "ijin":
        summary[key].ijin++;
        break;
      case "alfa":
        summary[key].alfa++;
        break;
    }

    summary[key].total_records++;
  });

  return Object.values(summary).map((student) => ({
    ...student,
    percentage:
      student.total_records > 0 ? student.hadir / student.total_records : 0,
  }));
}
// Modifikasi fungsi generateExcel untuk mendukung multiple sheets
async function generateExcelWithSummary(
  detailData,
  summaryData,
  detailFields,
  summaryFields,
  reportTitle = "",
  reportPeriod = ""
) {
  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Detail Data
  const detailWorksheet = workbook.addWorksheet("Detail Absensi");
  addWorksheetContent(
    detailWorksheet,
    detailData,
    detailFields,
    reportTitle,
    reportPeriod
  );

  // Sheet 2: Summary Data
  const summaryWorksheet = workbook.addWorksheet("Rekapitulasi");
  const summaryTitle = reportTitle.replace(
    "Laporan Absensi",
    "Rekapitulasi Absensi"
  );
  addWorksheetContent(
    summaryWorksheet,
    summaryData,
    summaryFields,
    summaryTitle,
    reportPeriod
  );

  return await workbook.xlsx.writeBuffer();
}

function addWorksheetContent(worksheet, data, fields, title, period) {
  let currentRow = 1;

  // Add title
  if (title) {
    worksheet.mergeCells(
      `A${currentRow}:${String.fromCharCode(
        65 + fields.length - 1
      )}${currentRow}`
    );
    worksheet.getCell(`A${currentRow}`).value = title;
    worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 16 };
    worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
    currentRow++;
  }

  // Add period
  if (period) {
    worksheet.mergeCells(
      `A${currentRow}:${String.fromCharCode(
        65 + fields.length - 1
      )}${currentRow}`
    );
    worksheet.getCell(`A${currentRow}`).value = period;
    worksheet.getCell(`A${currentRow}`).font = { bold: false, size: 12 };
    worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
    currentRow++;
  }

  if (title || period) {
    currentRow++;
  }

  // Set up columns
  worksheet.columns = fields.map((field) => ({
    header: field.label,
    key: field.value,
    width: field.width || 15,
  }));

  const headerRowNumber = currentRow;
  worksheet.getRow(headerRowNumber).values = fields.map((field) => field.label);

  // Add data
  worksheet.addRows(data);

  // Apply styling
  applyWorksheetStyling(worksheet, headerRowNumber, fields);
}

function applyWorksheetStyling(worksheet, headerRowNumber, fields) {
  // Style headers
  worksheet.getRow(headerRowNumber).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF404040" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FF000000" } },
      bottom: { style: "thin", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FF000000" } },
    };
  });

  // Style data rows
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > headerRowNumber) {
      const isEvenRow = (rowNumber - headerRowNumber) % 2 === 0;

      row.eachCell((cell, colNumber) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isEvenRow ? "FFF5F5F5" : "FFFFFFFF" },
        };

        cell.border = {
          top: { style: "thin", color: { argb: "FFD3D3D3" } },
          left: { style: "thin", color: { argb: "FFD3D3D3" } },
          bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
          right: { style: "thin", color: { argb: "FFD3D3D3" } },
        };

        cell.alignment = { horizontal: "center", vertical: "middle" };

        const field = fields[colNumber - 1];
        if (field && field.value === "percentage") {
          cell.numFmt = "0.0%";
        }
      });
    }
  });
}
router.get(
  "/download/date-range",
  authenticateToken,
  authorizeRole(["admin", "secretary"]),
  async (req, res) => {
    try {
      let { start_date, end_date, class_id } = req.query;

      if (!start_date || !end_date) {
        return res
          .status(400)
          .json({ message: "Start date and end date are required" });
      }

      let targetClassId = null;
      if (req.user.role === "secretary") {
        targetClassId = req.user.class_id;
      } else if (class_id) {
        targetClassId = class_id;
      }

      const detailReport = await Attendance.getByDateRange(
        start_date,
        end_date,
        targetClassId
      );

      if (detailReport.length === 0) {
        return res.status(404).json({
          message: `No attendance data found for the date range ${start_date} to ${end_date} ${
            targetClassId ? `for class ${targetClassId}` : ""
          }`,
        });
      }
      let className = "";
      if (targetClassId) {
        const classData = await Class.findById(targetClassId);
        if (classData) {
          className = classData.class_name;
        }
      }

      // Create summary data
      const summaryReport = createAttendanceSummary(detailReport);

      // Fields for detail sheet
      const detailFields = [
        { label: "Tanggal Absensi", value: "attendance_date", width: 20 },
        { label: "NIS", value: "nis", width: 15 },
        { label: "Nama Lengkap", value: "full_name", width: 30 },
        { label: "Kelas", value: "class_name", width: 15 },
        { label: "Status", value: "status", width: 15 },
        { label: "Catatan", value: "notes", width: 40 },
        { label: "Dicatat Oleh", value: "recorded_by_name", width: 25 },
      ];

      // Fields for summary sheet
      const summaryFields = [
        { label: "NIS", value: "nis", width: 15 },
        { label: "Nama Siswa", value: "full_name", width: 30 },
        { label: "Kelas", value: "class_name", width: 15 },
        { label: "Hadir", value: "hadir", width: 10 },
        { label: "Sakit", value: "sakit", width: 10 },
        { label: "Ijin", value: "ijin", width: 10 },
        { label: "Alfa", value: "alfa", width: 10 },
        { label: "Total", value: "total_records", width: 10 },
        { label: "Persentase Kehadiran", value: "percentage", width: 20 },
      ];

      let reportTitle = `Laporan Absensi Rentang Tanggal`;
      const reportPeriod = `Periode: ${moment(start_date).format(
        "DD MMMM YYYY"
      )} hingga ${moment(end_date).format("DD MMMM YYYY")}`;

      if (targetClassId) {
        reportTitle = `Persentase Kehadiran kelas : ${className}`;
      }

      const excelBuffer = await generateExcelWithSummary(
        detailReport,
        summaryReport,
        detailFields,
        summaryFields,
        reportTitle,
        reportPeriod
      );

      res.header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.attachment(
        `Laporan_Absensi_Tanggal_${start_date}_${end_date}${
          targetClassId ? `_Kelas_${className}` : ""
        }.xlsx`
      );
      return res.send(excelBuffer);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);
router.get(
  "/download/month-range",
  authenticateToken,
  authorizeRole(["admin", "secretary"]),
  async (req, res) => {
    try {
      const {
        class_id,
        start_month,
        start_year,
        end_month,
        end_year,
        detailed,
      } = req.query;

      if (!class_id || !start_month || !start_year || !end_month || !end_year) {
        return res.status(400).json({
          message:
            "Class ID, start month, start year, end month, and end year are required",
        });
      }

      let targetClassId = class_id;
      if (req.user.role === "secretary") {
        targetClassId = req.user.class_id;
      }
       const classData = await Class.findById(targetClassId);
      if (!classData) {
        return res
          .status(404)
          .json({ message: `Class with ID ${targetClassId} not found` });
      }
      const className = classData.class_name;

      const startMonthInt = parseInt(start_month);
      const startYearInt = parseInt(start_year);
      const endMonthInt = parseInt(end_month);
      const endYearInt = parseInt(end_year);

      // Basic validation
      if (
        startMonthInt < 1 ||
        startMonthInt > 12 ||
        endMonthInt < 1 ||
        endMonthInt > 12
      ) {
        return res.status(400).json({ message: "Month must be between 1-12" });
      }
      if (
        startYearInt > endYearInt ||
        (startYearInt === endYearInt && startMonthInt > endMonthInt)
      ) {
        return res.status(400).json({
          message: "Start period cannot be greater than end period",
        });
      }

      let reportData;
      let fields;
      let filenamePrefix = "Laporan_Absensi_Bulan_Range";
      let sheetNamePrefix = "Ringkasan Bulanan";
      let reportTitle = `Persentase Kehadiran kelas : ${className}`;
      let reportPeriod;

      const startMoment = moment(
        `${startYearInt}-${startMonthInt.toString().padStart(2, "0")}-01`
      );
      const endMoment = moment(
        `${endYearInt}-${endMonthInt.toString().padStart(2, "0")}-01`
      ).endOf("month");

      if (startMonthInt === endMonthInt && startYearInt === endYearInt) {
        reportPeriod = `Bulan: ${startMoment.format("MMMM YYYY")}`;
      } else {
        reportPeriod = `Periode: ${startMoment.format(
          "MMMM YYYY"
        )} hingga ${endMoment.format("MMMM YYYY")}`;
      }

      if (detailed === "true") {
        reportData = await Attendance.getDetailedAttendanceReportByMonthRange(
          targetClassId,
          startMonthInt,
          startYearInt,
          endMonthInt,
          endYearInt
        );

        filenamePrefix = "Laporan_Absensi_Detail_Bulan_Range";
        sheetNamePrefix = "Detail Bulanan";
        reportTitle = `Laporan Absensi Detail Bulanan Kelas ${className}`;

        // Flatten detailed data
        const flattenedData = [];
        reportData.forEach((student) => {
          if (student.months && student.months.length > 0) {
            student.months.forEach((monthData) => {
              const percentage =
                monthData.total_recorded > 0
                  ? monthData.hadir / monthData.total_recorded
                  : 0;

              flattenedData.push({
                nis: student.nis,
                full_name: student.full_name,
                year: monthData.year,
                month_name: monthData.month_name,
                hadir: monthData.hadir,
                sakit: monthData.sakit,
                ijin: monthData.ijin,
                alfa: monthData.alfa,
                total_recorded: monthData.total_recorded,
                percentage: percentage,
              });
            });
          } else {
            flattenedData.push({
              nis: student.nis,
              full_name: student.full_name,
              year: null,
              month_name: null,
              hadir: 0,
              sakit: 0,
              ijin: 0,
              alfa: 0,
              total_recorded: 0,
              percentage: 0,
            });
          }
        });

        fields = [
          { label: "NIS", value: "nis", width: 15 },
          { label: "Nama Siswa", value: "full_name", width: 25 },
          { label: "Tahun", value: "year", width: 10 },
          { label: "Bulan", value: "month_name", width: 15 },
          { label: "Hadir", value: "hadir", width: 10 },
          { label: "Sakit", value: "sakit", width: 10 },
          { label: "Ijin", value: "ijin", width: 10 },
          { label: "Alfa", value: "alfa", width: 10 },
          { label: "Total", value: "total_recorded", width: 10 },
          { label: "Persentase", value: "percentage", width: 15 },
        ];

        reportData = flattenedData;
      } else {
        reportData = await Attendance.getAttendanceReportByMonthRange(
          targetClassId,
          startMonthInt,
          startYearInt,
          endMonthInt,
          endYearInt
        );

        // Add percentage calculation for summary report
        reportData = reportData.map((student) => {
          const percentage =
            student.total_recorded > 0
              ? student.hadir / student.total_recorded
              : 0;

          return {
            ...student,
            percentage: percentage,
          };
        });

        fields = [
          { label: "NIS", value: "nis", width: 15 },
          { label: "Nama Siswa", value: "full_name", width: 25 },
          { label: "Hadir", value: "hadir", width: 10 },
          { label: "Sakit", value: "sakit", width: 10 },
          { label: "Ijin", value: "ijin", width: 10 },
          { label: "Alfa", value: "alfa", width: 10 },
          { label: "Total", value: "total_recorded", width: 10 },
          { label: "Persentase", value: "percentage", width: 15 },
        ];
      }

      if (reportData.length === 0) {
        return res.status(404).json({
          message: `No attendance data found for the month range ${start_month}/${start_year} to ${end_month}/${end_year} for class ${className}`,
        });
      }

      const sheetName = `${sheetNamePrefix} ${start_month}-${start_year} sd ${end_month}-${end_year}`;
      const excelBuffer = await generateExcel(
        reportData,
        fields,
        sheetName,
        reportTitle,
        reportPeriod
      );

      res.header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.attachment(
        `${filenamePrefix}_${className}_${start_month}-${start_year}_${end_month}-${end_year}.xlsx`
      );
      return res.send(excelBuffer);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);
module.exports = router;
