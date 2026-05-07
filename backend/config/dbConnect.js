import mysql from "mysql";

const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "emailmarketing",
  port: Number(process.env.DB_PORT || 3306),
  charset: "UTF8MB4_UNICODE_CI",
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }

  db.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci", (setNamesError) => {
    if (setNamesError) {
      console.error(
        "Failed to set utf8mb4 connection settings:",
        setNamesError,
      );
      return;
    }

    console.log("MySQL connection character set configured to utf8mb4");
  });

  console.log("Connected to MySQL database");
});

export default db;
