import multer from "multer";
import path from "path";

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "contacts-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter to accept CSV and XLSX files
const fileFilter = (req, file, cb) => {
  const filename = String(file.originalname || "").toLowerCase();
  const mimeType = String(file.mimetype || "").toLowerCase();

  const isCsv = mimeType === "text/csv" || filename.endsWith(".csv");
  const isXlsx =
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    filename.endsWith(".xlsx");

  if (isCsv || isXlsx) {
    cb(null, true);
  } else {
    cb(new Error("Only CSV and XLSX files are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

export default upload;
