import db from "../config/database.js";

const login = (req, res) => {
  const query = "SELECT * FROM user WHERE user_email = ? AND user_password = ?";
  db.query(query, [req.body.email, req.body.password], (err, data) => {
    if (err) {
      console.error("Database query error:", err);
      return res.json("error");
    }
    if (data.length > 0) {
      return res.json("success");
    } else {
      return res.json("failure");
    }
  });
};

export default {
  login,
};
