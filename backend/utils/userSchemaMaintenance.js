import { queryDb } from "./db.js";

const ensureUserLastLoginColumn = async () => {
  try {
    const columns = await queryDb(
      `SHOW COLUMNS FROM users LIKE 'last_login_at'`,
    );

    if (columns.length > 0) {
      return;
    }

    await queryDb(
      `ALTER TABLE users
       ADD COLUMN last_login_at TIMESTAMP NULL DEFAULT NULL AFTER updated_at`,
    );

    console.log("[users] added last_login_at column");
  } catch (error) {
    console.error(
      `[users] failed to ensure last_login_at column: ${error.message}`,
    );
  }
};

export { ensureUserLastLoginColumn };
