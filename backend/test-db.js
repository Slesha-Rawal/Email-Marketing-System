import db from "./config/dbConnect.js";

// Test database connection and query
console.log("Testing database connection...");

db.query("SHOW TABLES", (err, tables) => {
  if (err) {
    console.error("Error showing tables:", err);
    process.exit(1);
  }
  console.log("Tables in database:", tables);

  // Check users table
  db.query("SELECT * FROM users", (err, users) => {
    if (err) {
      console.error("Error querying users table:", err);
      process.exit(1);
    }
    console.log("Users in database:", users);

    // Test login query
    const testEmail = "admin@example.com";
    const testPassword = "admin123";
    const query =
      "SELECT * FROM users WHERE user_email = ? AND user_password = ?";

    db.query(query, [testEmail, testPassword], (err, result) => {
      if (err) {
        console.error("Error testing login query:", err);
        process.exit(1);
      }
      console.log("Login query result:", result);
      if (result.length > 0) {
        console.log("✅ Login test successful!");
      } else {
        console.log("❌ Login test failed - no matching user found");
      }
      process.exit(0);
    });
  });
});
