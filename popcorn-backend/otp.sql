CREATE TABLE IF NOT EXISTS email_otps (
    email VARCHAR(255) PRIMARY KEY,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
