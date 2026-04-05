# 📊 PopCorn SQL Query Guide

This document provides a technical explanation of every SQL query implemented in the `server.js` backend.

## 1. User Authentication & Verification

### Registering a New User
**Query:** `CALL sp_register_user($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL)`
*   **Purpose:** Handles the entire registration workflow in one atomic step.
*   **Logic:** It verifies the OTP, checks if the email is already taken, inserts the new user, and deletes the used OTP.

### Logging In
**Query:** `SELECT * FROM users WHERE email = $1`
*   **Purpose:** Retrieves the user's hashed password and profile data.
*   **DBMS Concept:** Index-based lookup on the `email` column for $O(1)$ performance.

### Email OTP Verification
**Query:** `INSERT INTO email_otps (email, otp_code, expires_at) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE ...`
*   **Purpose:** Saves a 6-digit code for verification.
*   **Power Feature:** Uses `ON CONFLICT` (Upsert) to overwrite old OTPs if a user requests a new one.
