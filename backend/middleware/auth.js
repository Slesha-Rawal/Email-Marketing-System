// Authentication middleware
const authenticate = (req, res, next) => {
  // TODO: Implement JWT token verification
  // For now, this is a placeholder
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  // Verify token logic will go here
  next();
};

module.exports = { authenticate };
