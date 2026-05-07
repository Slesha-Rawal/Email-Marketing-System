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

const ensureUserAvatarColumn = async () => {
  try {
    const columns = await queryDb(
      `SHOW COLUMNS FROM users LIKE 'user_avatar_url'`,
    );

    if (columns.length > 0) {
      return;
    }

    await queryDb(
      `ALTER TABLE users
       ADD COLUMN user_avatar_url VARCHAR(500) NULL AFTER user_status`,
    );

    console.log("[users] added user_avatar_url column");
  } catch (error) {
    console.error(
      `[users] failed to ensure user_avatar_url column: ${error.message}`,
    );
  }
};

const ensureCampaignUpdatedByColumn = async () => {
  try {
    const columns = await queryDb(
      `SHOW COLUMNS FROM campaigns LIKE 'updated_by'`,
    );

    if (columns.length > 0) {
      return;
    }

    await queryDb(
      `ALTER TABLE campaigns
       ADD COLUMN updated_by INT NULL AFTER created_by`,
    );

    console.log("[campaigns] added updated_by column");
  } catch (error) {
    console.error(
      `[campaigns] failed to ensure updated_by column: ${error.message}`,
    );
  }
};

const ensureUserRoleMigration = async () => {
  try {
    const columns = await queryDb(`SHOW COLUMNS FROM users LIKE 'user_role'`);

    if (columns.length === 0) {
      return;
    }

    const columnType = String(columns[0].Type || "").toLowerCase();

    if (columnType.includes("'users'") && !columnType.includes("'marketing'")) {
      return;
    }

    await queryDb(
      `ALTER TABLE users
       MODIFY user_role ENUM('admin', 'marketing', 'users') NOT NULL`,
    );

    await queryDb(
      `UPDATE users
       SET user_role = 'users'
       WHERE user_role = 'marketing'`,
    );

    await queryDb(
      `ALTER TABLE users
       MODIFY user_role ENUM('admin', 'users') NOT NULL`,
    );

    console.log("[users] migrated marketing role to users");
  } catch (error) {
    console.error(`[users] failed to migrate user_role enum: ${error.message}`);
  }
};

const ensureTrustedLoginDevicesTable = async () => {
  try {
    await queryDb(
      `CREATE TABLE IF NOT EXISTS trusted_login_devices (
         device_id INT PRIMARY KEY AUTO_INCREMENT,
         user_id INT NOT NULL,
         fingerprint_hash VARCHAR(64) NOT NULL,
         ip_address VARCHAR(45) NULL,
         user_agent VARCHAR(500) NULL,
         first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         UNIQUE KEY unique_user_fingerprint (user_id, fingerprint_hash),
         INDEX idx_trusted_device_user (user_id),
         FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
       )`,
    );
  } catch (error) {
    console.error(
      `[users] failed to ensure trusted_login_devices table: ${error.message}`,
    );
  }
};

const ensureLoginOtpRequestsTable = async () => {
  try {
    await queryDb(
      `CREATE TABLE IF NOT EXISTS login_otp_requests (
         otp_request_id INT PRIMARY KEY AUTO_INCREMENT,
         challenge_id VARCHAR(64) NOT NULL UNIQUE,
         user_id INT NOT NULL,
         fingerprint_hash VARCHAR(64) NOT NULL,
         otp_hash VARCHAR(64) NOT NULL,
         attempts_left INT NOT NULL DEFAULT 5,
         resend_count INT NOT NULL DEFAULT 0,
         expires_at DATETIME NOT NULL,
         resend_available_at DATETIME NOT NULL,
         consumed_at DATETIME NULL,
         ip_address VARCHAR(45) NULL,
         user_agent VARCHAR(500) NULL,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         last_sent_at DATETIME NOT NULL,
         INDEX idx_login_otp_user_pending (user_id, consumed_at),
         INDEX idx_login_otp_expires_at (expires_at),
         FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
       )`,
    );
  } catch (error) {
    console.error(
      `[users] failed to ensure login_otp_requests table: ${error.message}`,
    );
  }
};

const ensureOtpStoreTable = async () => {
  try {
    await queryDb(
      `CREATE TABLE IF NOT EXISTS otp_store (
         user_id INT PRIMARY KEY,
         otp_hash VARCHAR(255) NOT NULL,
         expires_at DATETIME NOT NULL,
         FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
       )`,
    );
  } catch (error) {
    console.error(`[users] failed to ensure otp_store table: ${error.message}`);
  }
};

const ensureRefreshTokenSessionsTable = async () => {
  try {
    await queryDb(
      `CREATE TABLE IF NOT EXISTS refresh_token_sessions (
         refresh_session_id INT PRIMARY KEY AUTO_INCREMENT,
         token_id VARCHAR(64) NOT NULL UNIQUE,
         user_id INT NOT NULL,
         token_hash CHAR(64) NOT NULL,
         expires_at DATETIME NOT NULL,
         revoked_at DATETIME NULL,
         replaced_by_token_id VARCHAR(64) NULL,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         INDEX idx_refresh_user_active (user_id, revoked_at, expires_at),
         INDEX idx_refresh_expires_at (expires_at),
         FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
       )`,
    );
  } catch (error) {
    console.error(
      `[users] failed to ensure refresh_token_sessions table: ${error.message}`,
    );
  }
};

const ensurePasswordResetTokensTable = async () => {
  try {
    await queryDb(
      `CREATE TABLE IF NOT EXISTS password_reset_tokens (
         password_reset_token_id INT PRIMARY KEY AUTO_INCREMENT,
         user_id INT NOT NULL,
         token_hash CHAR(64) NOT NULL UNIQUE,
         expires_at DATETIME NOT NULL,
         used_at DATETIME NULL,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         INDEX idx_password_reset_user_active (user_id, used_at, expires_at),
         INDEX idx_password_reset_expires_at (expires_at),
         FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
       )`,
    );
  } catch (error) {
    console.error(
      `[users] failed to ensure password_reset_tokens table: ${error.message}`,
    );
  }
};

const ensureAuthSecurityTables = async () => {
  await ensureUserRoleMigration();
  await ensureTrustedLoginDevicesTable();
  await ensureLoginOtpRequestsTable();
  await ensureOtpStoreTable();
  await ensureRefreshTokenSessionsTable();
  await ensurePasswordResetTokensTable();
};

const ensureContactsUtf8mb4 = async () => {
  try {
    const tableExists = await queryDb(`SHOW TABLES LIKE 'contacts'`);

    if (tableExists.length === 0) {
      return;
    }

    await queryDb(
      `ALTER TABLE contacts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } catch (error) {
    console.error(
      `[contacts] failed to ensure utf8mb4 encoding: ${error.message}`,
    );
  }
};

export {
  ensureUserLastLoginColumn,
  ensureUserAvatarColumn,
  ensureCampaignUpdatedByColumn,
  ensureUserRoleMigration,
  ensureAuthSecurityTables,
  ensureContactsUtf8mb4,
};
