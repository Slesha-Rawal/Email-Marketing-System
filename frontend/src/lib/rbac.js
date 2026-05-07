const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase();

const hasRole = (user, allowedRoles = []) => {
  const userRole = normalizeRole(user?.role);
  if (!userRole) {
    return false;
  }

  return allowedRoles.map(normalizeRole).includes(userRole);
};

const isAdmin = (user) => hasRole(user, ["admin"]);
const isUsers = (user) => hasRole(user, ["users", "admin"]);

export { normalizeRole, hasRole, isAdmin, isUsers };
