import React, { useState, useRef } from 'react';
import './Auth.css';

function LoginForm({ onLoginSuccess, onClose }) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  // Registration fiels
  const [regData, setRegData] = useState({
    full_name: '',
    date_of_birth: '',
    gender: '',
    phone_number: '',
    address: ''
  });
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const fileInputRef = useRef(null);

  const [isRegister, setIsRegister] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [successClosing, setSuccessClosing] = useState(false);
  const [successUser, setSuccessUser] = useState(null);
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleRegChange = (e) => {
    setRegData({
      ...regData,
      [e.target.name]: e.target.value
    });
  };

  const handleProfilePicture = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage('❌ Please select a valid image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage('❌ Image size must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePicture(reader.result);
      setProfilePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeProfilePicture = () => {
    setProfilePicture(null);
    setProfilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateRegistration = () => {
    if (!regData.full_name || regData.full_name.trim().length < 2) {
      return 'Full name is required (at least 2 characters)';
    }
    if (!formData.email) {
      return 'Email is required';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return 'Please enter a valid email address';
    }
    if (!formData.password || formData.password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    if (regData.date_of_birth) {
      const dob = new Date(regData.date_of_birth);
      if (isNaN(dob.getTime()) || dob >= new Date()) {
        return 'Please provide a valid date of birth';
      }
    }
    if (regData.phone_number && regData.phone_number.trim() !== '') {
      const phoneRegex = /^[+]?[\d\s()-]{7,20}$/;
      if (!phoneRegex.test(regData.phone_number)) {
        return 'Invalid phone number format';
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setIsLoading(true);

    try {
      if (isRegister) {
        const validationError = validateRegistration();
        if (validationError) {
          throw new Error(validationError);
        }
      }

      let endpoint = 'https://popcorn-s9v4.onrender.com/api/login';
      if (isRegister) {
        endpoint = otpMode ? 'https://popcorn-s9v4.onrender.com/api/register' : 'https://popcorn-s9v4.onrender.com/api/send-otp';
      }

      const requestBody = {
        email: formData.email,
        password: formData.password
      };

      if (isRegister) {
        requestBody.full_name = regData.full_name;
        requestBody.date_of_birth = regData.date_of_birth || null;
        requestBody.gender = regData.gender || null;
        requestBody.phone_number = regData.phone_number || null;
        requestBody.address = regData.address || null;
        requestBody.profile_picture = profilePicture || null;
        if (otpMode) {
          requestBody.otp_code = otpCode;
        }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Authentication failed');
      }

      if (isRegister && !otpMode) {
        // Show OTP input state
        setOtpMode(true);
        setMessage('✅ OTP code sent to your email!');
        return;
      }

      // Login success 
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      localStorage.setItem('user', JSON.stringify(data.user));

      setSuccessUser(data.user);
      setLoginSuccess(true);

      // After animation, close the form
      setTimeout(() => {
        setSuccessClosing(true);
        setTimeout(() => {
          onLoginSuccess(data.user);
          if (onClose) onClose();
        }, 500);
      }, 2000);

    } catch (error) {
      setMessage(`❌ ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('https://popcorn-s9v4.onrender.com/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: regData.full_name
        })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage('✅ OTP code resent!');
      } else {
        setMessage(`❌ ${data.error || 'Failed to resend'}`);
      }
    } catch (err) {
      setMessage('❌ Failed to resend OTP code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setMessage('Password reset link sent to your email! 📧');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleClose = () => {
    if (onClose) onClose();
  };

  return (
    <div className="auth-overlay">
      <div className={`auth-container ${isRegister ? 'auth-container-register' : ''}`}>

        <button className="close-btn" onClick={handleClose}>×</button>

        {loginSuccess && (
          <div className={`login-success-overlay ${successClosing ? 'closing' : ''}`}>
            <div className="success-checkmark">
              <svg viewBox="0 0 24 24">
                <path className="check-path" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="success-text">
              Welcome back, {successUser?.username || successUser?.email?.split('@')[0]}!
            </div>
            <div className="success-subtext">You're all set 🎬</div>
            <div className="success-redirect">Redirecting to PopCorn...</div>
          </div>
        )}

        {/* OTP*/}
        {otpMode && !loginSuccess && (
          <div className="verification-sent">
            <div className="email-icon">🔐</div>
            <h3>Verify Your Email</h3>
            <p>We've sent a 6-digit OTP code to:</p>
            <p style={{ color: '#f5c518', fontWeight: 600, fontSize: '1.1rem' }}>{formData.email}</p>
            <p>Enter the code below to complete your registration.</p>

            <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: '20px' }}>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  maxLength={6}
                  required
                  disabled={isLoading}
                  style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '4px' }}
                />
              </div>
              <button type="submit" className="auth-submit" disabled={isLoading || otpCode.length < 6}>
                {isLoading ? 'Verifying...' : 'Verify & Create Account'}
              </button>
            </form>

            <button
              className="resend-btn"
              onClick={handleResendOTP}
              disabled={isLoading}
              style={{ marginTop: '15px' }}
            >
              Resend Code
            </button>
            {message && (
              <div className={`message ${message.includes('✅') ? 'success' : 'error'}`} style={{ marginTop: '16px' }}>
                {message}
              </div>
            )}
            <div className="auth-toggle" style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="toggle-btn"
                onClick={() => { setOtpMode(false); setMessage(''); }}
              >
                ← Back to Details
              </button>
            </div>
          </div>
        )}

        {/* Normal Form (hide kora) */}
        {!loginSuccess && !otpMode && (
          <>
            <div className="auth-header">
              <div className="logo-icon">🎬</div>
              <h1 className="auth-title">
                {isRegister ? 'Join PopCorn' : 'Welcome Back'}
              </h1>
              <p className="auth-subtitle">
                {isRegister
                  ? 'Create your account to save watchlist & ratings'
                  : 'Sign in to continue your cinematic journey'
                }
              </p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              {/* Registrationonly fields */}
              {isRegister && (
                <>
                  <div className="profile-picture-section">
                    <div
                      className="profile-picture-preview"
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    >
                      {profilePreview ? (
                        <img src={profilePreview} alt="Profile preview" className="profile-preview-img" />
                      ) : (
                        <div className="profile-placeholder">
                          <span className="profile-placeholder-icon">📷</span>
                          <span className="profile-placeholder-text">Add Photo</span>
                        </div>
                      )}
                    </div>
                    {profilePreview && (
                      <button
                        type="button"
                        className="remove-picture-btn"
                        onClick={removeProfilePicture}
                      >
                        ✕ Remove
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePicture}
                      className="file-input-hidden"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label>Full Name <span className="required-star">*</span></label>
                    <input
                      type="text"
                      name="full_name"
                      placeholder="Enter your full name"
                      value={regData.full_name}
                      onChange={handleRegChange}
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group form-group-half">
                      <label>Date of Birth</label>
                      <input
                        type="date"
                        name="date_of_birth"
                        value={regData.date_of_birth}
                        onChange={handleRegChange}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="form-group form-group-half">
                      <label>Gender</label>
                      <select
                        name="gender"
                        value={regData.gender}
                        onChange={handleRegChange}
                        disabled={isLoading}
                        className="auth-select"
                      >
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      name="phone_number"
                      placeholder="+880 1XXX-XXXXXX"
                      value={regData.phone_number}
                      onChange={handleRegChange}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label>Address</label>
                    <textarea
                      name="address"
                      placeholder="Your address (optional)"
                      value={regData.address}
                      onChange={handleRegChange}
                      disabled={isLoading}
                      className="auth-textarea"
                      rows="2"
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Email <span className="required-star">*</span></label>
                <input
                  type="email"
                  name="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label>Password <span className="required-star">*</span></label>
                <input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
                {isRegister && (
                  <span className="field-hint">Minimum 6 characters</span>
                )}
              </div>

              <button type="submit" className="auth-submit" disabled={isLoading}>
                {isLoading ? 'Processing...' : (isRegister ? 'Create Account' : 'Sign In')}
              </button>
            </form>

            {message && (
              <div className={`message ${message.includes('successful') || message.includes('✅') ? 'success' : message.includes('❌') ? 'error' : ''}`}>
                {message}
              </div>
            )}

            {!isRegister && (
              <div className="forgot-password">
                <button
                  type="button"
                  className="forgot-btn"
                  onClick={handleForgotPassword}
                  disabled={isLoading}
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <div className="auth-toggle">
              {isRegister ? (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="toggle-btn"
                    onClick={() => setIsRegister(false)}
                    disabled={isLoading}
                  >
                    Sign In
                  </button>
                </>
              ) : (
                <>
                  Still Unregistered?{' '}
                  <button
                    type="button"
                    className="toggle-btn"
                    onClick={() => { setIsRegister(true); setOtpMode(false); }}
                    disabled={isLoading}
                  >
                    Create Account
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default LoginForm;
