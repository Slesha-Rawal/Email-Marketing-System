import fs from "fs";
import path from "path";
import mysql from "mysql";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, "db", "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

const connection = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  port: Number(process.env.DB_PORT || 3306),
  multipleStatements: true,
});

connection.connect((connectError) => {
  if (connectError) {
    console.error("Database connection failed:", connectError);
    process.exit(1);
  }

  connection.query(schema, (queryError) => {
    if (queryError) {
      console.error("Database reset failed:", queryError);
      connection.end();
      process.exit(1);
    }

    console.log("Database reset completed successfully.");
    connection.end();
  });
});
