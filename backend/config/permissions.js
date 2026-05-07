const ROLES = {
  ADMIN: "admin",
  USERS: "users",
};

const PERMISSIONS = {
  SMTP_CONFIG_READ: "smtp:read",
  CONTACTS_READ: "contacts:read",
  CONTACTS_WRITE: "contacts:write",
  CONTACT_GROUPS_READ: "contact-groups:read",
  CONTACT_GROUPS_WRITE: "contact-groups:write",
  TEMPLATES_READ: "templates:read",
  TEMPLATES_WRITE: "templates:write",
  CAMPAIGNS_READ: "campaigns:read",
  CAMPAIGNS_WRITE: "campaigns:write",
  CAMPAIGNS_SEND: "campaigns:send",
  EMAIL_LOGS_READ: "email-logs:read",
  ANALYTICS_READ: "analytics:read",
  ADMIN_USERS_MANAGE: "admin-users:manage",
};

const PERMISSION_TO_ROLES = {
  [PERMISSIONS.SMTP_CONFIG_READ]: [ROLES.ADMIN],
  [PERMISSIONS.CONTACTS_READ]: [ROLES.USERS, ROLES.ADMIN],
  [PERMISSIONS.CONTACTS_WRITE]: [ROLES.USERS, ROLES.ADMIN],
  [PERMISSIONS.CONTACT_GROUPS_READ]: [ROLES.USERS, ROLES.ADMIN],
  [PERMISSIONS.CONTACT_GROUPS_WRITE]: [ROLES.USERS, ROLES.ADMIN],
  [PERMISSIONS.TEMPLATES_READ]: [ROLES.USERS, ROLES.ADMIN],
  [PERMISSIONS.TEMPLATES_WRITE]: [ROLES.USERS, ROLES.ADMIN],
  [PERMISSIONS.CAMPAIGNS_READ]: [ROLES.USERS, ROLES.ADMIN],
  [PERMISSIONS.CAMPAIGNS_WRITE]: [ROLES.USERS, ROLES.ADMIN],
  [PERMISSIONS.CAMPAIGNS_SEND]: [ROLES.USERS, ROLES.ADMIN],
  [PERMISSIONS.EMAIL_LOGS_READ]: [ROLES.USERS, ROLES.ADMIN],
  [PERMISSIONS.ANALYTICS_READ]: [ROLES.USERS, ROLES.ADMIN],
  [PERMISSIONS.ADMIN_USERS_MANAGE]: [ROLES.ADMIN],
};

const normalizeRole = (role) =>
  String(role || "")
    .trim()
    .toLowerCase();

const allowedRolesForPermission = (permission) => {
  return (PERMISSION_TO_ROLES[permission] || []).map(normalizeRole);
};

const hasPermission = (role, permission) => {
  const normalizedRole = normalizeRole(role);
  const allowedRoles = allowedRolesForPermission(permission);
  return allowedRoles.includes(normalizedRole);
};

export {
  ROLES,
  PERMISSIONS,
  PERMISSION_TO_ROLES,
  normalizeRole,
  allowedRolesForPermission,
  hasPermission,
};
