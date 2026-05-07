import mysql from "mysql";

const db = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "emailmarketing",
  port: Number(process.env.DB_PORT || 3306),
  charset: "UTF8MB4_UNICODE_CI",
  multipleStatements: true,
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }

  connection.query(
    "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
    (setNamesError) => {
      connection.release();
      if (setNamesError) {
        console.error(
          "Failed to set utf8mb4 connection settings:",
          setNamesError,
        );
        return;
      }

      console.log("MySQL pool connection character set configured to utf8mb4");
    },
  );

  console.log("Connected to MySQL database via connection pool");
});

export default db;
