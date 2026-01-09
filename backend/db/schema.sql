-- Create database
CREATE DATABASE IF NOT EXISTS emailmarketing;
USE emailmarketing;

-- Create user table
CREATE TABLE IF NOT EXISTS user (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample user (for testing only - use hashed passwords in production)
INSERT INTO user (email, password) VALUES ('admin@gmail.com', 'Admin@123')
ON DUPLICATE KEY UPDATE email = email;
