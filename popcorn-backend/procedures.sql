
CREATE OR REPLACE PROCEDURE sp_update_user_privileges(
    p_admin_id INT,
    p_target_user_id INT,
    p_is_admin BOOLEAN,
    p_log_msg TEXT,
    p_notif_msg TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE users SET is_admin = p_is_admin WHERE user_id = p_target_user_id;

    INSERT INTO admin_activity_logs (admin_id, action_type, target_entity, target_id, details)
    VALUES (p_admin_id, CASE WHEN p_is_admin THEN 'MAKE_ADMIN' ELSE 'REVOKE_ADMIN' END, 'users', p_target_user_id, p_log_msg);

    INSERT INTO notifications (user_id, sender_id, type, message, created_at, is_read)
    VALUES (p_target_user_id, p_admin_id, 'SYSTEM', p_notif_msg, NOW(), FALSE);

    COMMIT;
END;
$$;


CREATE OR REPLACE PROCEDURE sp_handle_user_ban(
    p_admin_id INT,
    p_target_user_id INT,
    p_ban_until TIMESTAMP,
    p_action VARCHAR,
    p_log_msg TEXT,
    p_notif_msg TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE users SET banned_until = p_ban_until WHERE user_id = p_target_user_id;

    INSERT INTO admin_activity_logs (admin_id, action_type, target_entity, target_id, details)
    VALUES (p_admin_id, p_action, 'users', p_target_user_id, p_log_msg);

    INSERT INTO notifications (user_id, sender_id, type, message, created_at, is_read)
    VALUES (p_target_user_id, p_admin_id, 'SYSTEM', p_notif_msg, NOW(), FALSE);

    COMMIT;
END;
$$;


CREATE OR REPLACE PROCEDURE sp_register_user(
    p_email VARCHAR,
    p_password_hash VARCHAR,
    p_username VARCHAR,
    p_full_name VARCHAR,
    p_date_of_birth DATE,
    p_gender VARCHAR,
    p_phone_number VARCHAR,
    p_address TEXT,
    p_profile_picture TEXT,
    p_otp_code VARCHAR,
    OUT p_user_id INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_otp_expires TIMESTAMP;
BEGIN
    SELECT expires_at INTO v_otp_expires 
    FROM email_otps 
    WHERE email = p_email AND otp_code = p_otp_code;

    IF v_otp_expires IS NULL THEN
        RAISE EXCEPTION 'Invalid OTP';
    END IF;

    IF NOW() > v_otp_expires THEN
        DELETE FROM email_otps WHERE email = p_email;
        RAISE EXCEPTION 'OTP Expired';
    END IF;

    IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
        RAISE EXCEPTION 'User already exists';
    END IF;

    INSERT INTO users (email, password, username, full_name, date_of_birth, gender, phone_number, address, profile_picture, is_verified) 
    VALUES (p_email, p_password_hash, p_username, p_full_name, p_date_of_birth, p_gender, p_phone_number, p_address, p_profile_picture, TRUE)
    RETURNING user_id INTO p_user_id;

    DELETE FROM email_otps WHERE email = p_email;

    COMMIT;
END;
$$;


CREATE OR REPLACE PROCEDURE sp_resolve_report(
    p_report_id INT,
    p_admin_id INT,
    p_status VARCHAR,
    p_note TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_reporter_id INT;
BEGIN
    UPDATE reports SET status = p_status WHERE id = p_report_id
    RETURNING reporter_id INTO v_reporter_id;

    INSERT INTO admin_activity_logs (admin_id, action_type, target_entity, target_id, details)
    VALUES (p_admin_id, 'RESOLVE_REPORT', 'reports', p_report_id, p_status || ': ' || p_note);

    IF v_reporter_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, sender_id, type, message, created_at, is_read)
        VALUES (v_reporter_id, p_admin_id, 'SYSTEM', 'Your report (ID: ' || p_report_id || ') has been ' || p_status || ' by the moderation team.', NOW(), FALSE);
    END IF;

    COMMIT;
END;
$$;
