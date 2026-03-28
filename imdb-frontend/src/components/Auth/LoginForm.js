import React, { useState, useRef } from 'react';
import './Auth.css';

function LoginForm({ onLoginSuccess, onClose }) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  // Registration-only fields
  const [regData, setRegData] = useState({
    full_name: '',
    date_of_birth: '',
    gender: '',
    phone_number: '',
    address: ''
  });
  const [profilePicture, setProfilePicture] = useState(null); // base64 string
  const [profilePreview, setProfilePreview] = useState(null); // preview URL
  const fileInputRef = useRef(null);

  const [isRegister, setIsRegister] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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


      const endpoint = isRegister ? 'http://localhost:5000/api/register' : 'http://localhost:5000/api/login';

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


      if (data.token) {
          localStorage.setItem('token', data.token);
      }
      localStorage.setItem('user', JSON.stringify(data.user)); 
      
      setMessage(isRegister ? 'Account created successfully! 🎉' : 'Login successful! 🎉 Welcome back!');
      
      setTimeout(() => {
        onLoginSuccess(data.user);
        if (onClose) onClose();
      }, 1500);

    } catch (error) {
      setMessage(`❌ ${error.message}`);
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
          {/* --- Registration-only fields --- */}
          {isRegister && (
            <>
              {/* Profile Picture Upload */}
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
          <div className={`message ${message.includes('successful') ? 'success' : ''}`}>
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
                onClick={() => setIsRegister(true)}
                disabled={isLoading}
              >
                Create Account
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginForm;


// import React, { useState } from 'react';
// import './Auth.css';

// function LoginForm({ onLoginSuccess, onClose }) {
//   const [formData, setFormData] = useState({
//     email: '',
//     password: ''
//   });
//   const [isRegister, setIsRegister] = useState(false);
//   const [message, setMessage] = useState('');
//   const [isLoading, setIsLoading] = useState(false);

//   const handleChange = (e) => {
//     setFormData({
//       ...formData,
//       [e.target.name]: e.target.value
//     });
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setMessage('');
//     setIsLoading(true);

//     // animation kore ashbe
//     setTimeout(() => {
//       const userData = {
//         id: Date.now(),
//         username: formData.email.split('@')[0],
//         email: formData.email,
//         token: 'fake-jwt-' + Date.now()
//       };

//       localStorage.setItem('user', JSON.stringify(userData));
//       setMessage('Login successful! 🎉 Welcome back!');
//       onLoginSuccess(userData);
      
//       setTimeout(() => {
//         if (onClose) onClose();
//         window.location.reload();
//       }, 1500);
//     }, 1200);
//   };

//   const handleForgotPassword = () => {
//     setMessage('Password reset link sent to your email! 📧');
//     setTimeout(() => setMessage(''), 3000);
//   };

//   const handleClose = () => {
//     if (onClose) onClose();
//   };

//   return (
//     <div className="auth-overlay">
//       <div className="auth-container">
        
//         <button className="close-btn" onClick={handleClose}>×</button>
        
//         <div className="auth-header">
//           <div className="logo-icon">🎬</div>
//           <h1 className="auth-title">
//             {isRegister ? 'Join PopCorn' : 'Welcome Back'}
//           </h1>
//           <p className="auth-subtitle">
//             {isRegister 
//               ? 'Create your account to save watchlist & ratings' 
//               : 'Sign in to continue your cinematic journey'
//             }
//           </p>
//         </div>

//         <form onSubmit={handleSubmit} className="auth-form">
//           <div className="form-group">
//             <label>Email</label>
//             <input
//               type="email"
//               name="email"
//               placeholder="your@email.com"
//               value={formData.email}
//               onChange={handleChange}
//               required
//               disabled={isLoading}
//             />
//           </div>
          
//           <div className="form-group">
//             <label>Password</label>
//             <input
//               type="password"
//               name="password"
//               placeholder="••••••••"
//               value={formData.password}
//               onChange={handleChange}
//               required
//               disabled={isLoading}
//             />
//           </div>

//           <button type="submit" className="auth-submit" disabled={isLoading}>
//             {isLoading ? 'Signing In...' : (isRegister ? 'Create Account' : 'Sign In')}
//           </button>
//         </form>


//         {message && (
//           <div className={`message ${message.includes('successful') ? 'success' : ''}`}>
//             {message}
//           </div>
//         )}

//         {!isRegister && (
//           <div className="forgot-password">
//             <button 
//               type="button" 
//               className="forgot-btn"
//               onClick={handleForgotPassword}
//               disabled={isLoading}
//             >
//               Forgot Password?
//             </button>
//           </div>
//         )}

//         <div className="auth-toggle">
//           {isRegister ? (
//             <>
//               Already have an account?{' '}
//               <button 
//                 type="button" 
//                 className="toggle-btn"
//                 onClick={() => setIsRegister(false)}
//                 disabled={isLoading}
//               >
//                 Sign In
//               </button>
//             </>
//           ) : (
//             <>
//               Still Unregistered?{' '}
//               <button 
//                 type="button" 
//                 className="toggle-btn"
//                 onClick={() => setIsRegister(true)}
//                 disabled={isLoading}
//               >
//                 Create Account
//               </button>
//             </>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// export default LoginForm;
