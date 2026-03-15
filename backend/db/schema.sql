-- Email Marketing System Database Schema
-- Drop and recreate the entire database for a clean start

DROP DATABASE IF EXISTS emailmarketing;
CREATE DATABASE emailmarketing;
USE emailmarketing;

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  user_id INT PRIMARY KEY AUTO_INCREMENT,
  user_email VARCHAR(255) NOT NULL UNIQUE,
  user_password VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  user_role ENUM('admin', 'marketing') NOT NULL,
  user_status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Contacts table for mailing list management
CREATE TABLE IF NOT EXISTS contacts (
  contact_id INT PRIMARY KEY AUTO_INCREMENT,
  contact_name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255) NOT NULL UNIQUE,
  contact_phone VARCHAR(20),
  contact_status ENUM('active', 'unsubscribed', 'bounced') DEFAULT 'active',
  subscription_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unsubscribe_date TIMESTAMP NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Contact Groups table
CREATE TABLE IF NOT EXISTS contact_groups (
  group_id INT PRIMARY KEY AUTO_INCREMENT,
  group_name VARCHAR(255) NOT NULL UNIQUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Contact Group Members table
CREATE TABLE IF NOT EXISTS contact_group_members (
  group_id INT NOT NULL,
  contact_id INT NOT NULL,
  added_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, contact_id),
  FOREIGN KEY (group_id) REFERENCES contact_groups(group_id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(contact_id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Templates table for email template management
CREATE TABLE IF NOT EXISTS templates (
  template_id INT PRIMARY KEY AUTO_INCREMENT,
  template_name VARCHAR(255) NOT NULL,
  template_subject VARCHAR(500) NOT NULL,
  template_body TEXT NOT NULL,
  template_html LONGTEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Campaigns table for email campaign management
CREATE TABLE IF NOT EXISTS campaigns (
  campaign_id INT PRIMARY KEY AUTO_INCREMENT,
  campaign_name VARCHAR(255) NOT NULL,
  campaign_subject VARCHAR(500) NOT NULL,
  campaign_body TEXT NULL,
  campaign_html LONGTEXT,
  template_id INT NULL,
  sender_name VARCHAR(255) NOT NULL,
  sender_email VARCHAR(255) NOT NULL,
  reply_to_email VARCHAR(255),
  contact_segment VARCHAR(255),
  campaign_status ENUM('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled') DEFAULT 'draft',
  scheduled_date TIMESTAMP NULL,
  sent_date TIMESTAMP NULL,
  total_recipients INT DEFAULT 0,
  total_sent INT DEFAULT 0,
  total_delivered INT DEFAULT 0,
  total_opened INT DEFAULT 0,
  total_clicked INT DEFAULT 0,
  total_bounced INT DEFAULT 0,
  total_unsubscribed INT DEFAULT 0,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES templates(template_id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Campaign Emails table (tracks which contacts received which campaigns)
CREATE TABLE IF NOT EXISTS campaign_emails (
  campaign_email_id INT PRIMARY KEY AUTO_INCREMENT,
  campaign_id INT NOT NULL,
  contact_id INT NOT NULL,
  email_status ENUM('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed') DEFAULT 'pending',
  sent_at TIMESTAMP NULL,
  delivered_at TIMESTAMP NULL,
  opened_at TIMESTAMP NULL,
  clicked_at TIMESTAMP NULL,
  bounced_at TIMESTAMP NULL,
  open_count INT DEFAULT 0,
  click_count INT DEFAULT 0,
  unique_tracking_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(contact_id) ON DELETE CASCADE,
  UNIQUE KEY unique_campaign_contact (campaign_id, contact_id)
);

-- Email Events table (detailed tracking of all email interactions)
CREATE TABLE IF NOT EXISTS email_events (
  event_id INT PRIMARY KEY AUTO_INCREMENT,
  campaign_email_id INT NOT NULL,
  event_type ENUM('sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed', 'complained') NOT NULL,
  event_data TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_email_id) REFERENCES campaign_emails(campaign_email_id) ON DELETE CASCADE,
  INDEX idx_event_type (event_type),
  INDEX idx_event_timestamp (event_timestamp)
);

-- Unsubscribe Feedback table
CREATE TABLE IF NOT EXISTS unsubscribe_feedback (
  feedback_id INT PRIMARY KEY AUTO_INCREMENT,
  contact_id INT NOT NULL,
  campaign_id INT NULL,
  reason ENUM('too_frequent', 'not_relevant', 'never_subscribed', 'spam', 'other') NOT NULL,
  additional_comments TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(contact_id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE SET NULL
);

-- CSV Import Log table (tracks CSV imports)
CREATE TABLE IF NOT EXISTS import_logs (
  import_id INT PRIMARY KEY AUTO_INCREMENT,
  file_name VARCHAR(255) NOT NULL,
  total_rows INT DEFAULT 0,
  successful_imports INT DEFAULT 0,
  duplicates_skipped INT DEFAULT 0,
  invalid_emails INT DEFAULT 0,
  import_status ENUM('processing', 'completed', 'failed') DEFAULT 'processing',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Seed role-based users
-- Admin login: admin@gmail.com / Admin@123
-- Marketing login: slesharawal3@gmail.com / Marketing@123
INSERT INTO users (user_email, user_password, user_name, user_role, user_status)
VALUES
('admin@gmail.com', '$2b$10$08ktWZFTeK7.jBFWIQoLIOxyUYMTkhGCcUBI2r4q5PGFfqfPlfysG', 'Admin User', 'admin', 'active'),
('slesharawal3@gmail.com', '$2b$10$YDLTkV8wbuInzZu6rQZ5pe.eZhndyKa4o.yA2DsManGj8icseYY2i', 'Marketing User', 'marketing', 'active')
ON DUPLICATE KEY UPDATE user_email = VALUES(user_email);

-- Insert sample contacts for testing
INSERT INTO contacts (contact_name, contact_email, contact_phone, contact_status, created_by) VALUES
('John Doe', 'john.doe@example.com', '+1234567890', 'active', 2),
('Jane Smith', 'jane.smith@example.com', '+1234567891', 'active', 2),
('Bob Johnson', 'bob.johnson@example.com', '+1234567892', 'unsubscribed', 2)
ON DUPLICATE KEY UPDATE contact_email = contact_email;

-- Insert sample templates
INSERT INTO templates (template_name, template_subject, template_body, created_by) VALUES
('Welcome Email', 'Welcome to Our Newsletter!', 'Hello {{name}},\n\nThank you for subscribing to our newsletter. We are excited to have you on board!\n\nBest regards,\nThe Team', 2),
('Monthly Newsletter', 'Your Monthly Product Update', 'Hi {{name}},\n\nHere is a quick summary of this month''s launches, events, and wins.\n\nRegards,\nMarketing Team', 2)
ON DUPLICATE KEY UPDATE template_name = template_name;

-- Insert sample campaigns for monitoring
INSERT INTO campaigns (
  campaign_name,
  campaign_subject,
  campaign_body,
  template_id,
  sender_name,
  sender_email,
  reply_to_email,
  contact_segment,
  campaign_status,
  scheduled_date,
  sent_date,
  total_recipients,
  total_sent,
  total_delivered,
  total_opened,
  total_clicked,
  total_bounced,
  total_unsubscribed,
  created_by
) VALUES
(
  'March Welcome Series',
  'Welcome to our March product update',
  'Hello {{name}}, welcome to the March update campaign.',
  1,
  'Marketing Team',
  'slesharawal3@gmail.com',
  'admin@gmail.com',
  'all',
  'sent',
  NULL,
  CURRENT_TIMESTAMP,
  1200,
  1200,
  1180,
  712,
  205,
  15,
  8,
  2
),
(
  'April Product Teaser',
  'A new release is coming soon',
  'Hello {{name}}, get ready for our next release.',
  2,
  'Marketing Team',
  'slesharawal3@gmail.com',
  'admin@gmail.com',
  'active',
  'scheduled',
  DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 7 DAY),
  NULL,
  850,
  0,
  0,
  0,
  0,
  0,
  0,
  2
)
ON DUPLICATE KEY UPDATE campaign_name = campaign_name;
