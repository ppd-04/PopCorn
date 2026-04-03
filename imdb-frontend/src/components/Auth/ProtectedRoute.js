import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(null);

    useEffect(() => {
        const verifyToken = async () => {
            const token = localStorage.getItem('token');
  
            if (!token) {
                setIsAuthenticated(false);
                return;
            }

            try {

                const response = await fetch('http://localhost:5000/api/verify', {
                    method: 'GET',
                    headers: { 
                        'Authorization': `Bearer ${token}` 
                    }
                });

                if (response.ok) {
                    setIsAuthenticated(true); 
                } else {
                    // habkjabi token
                    localStorage.removeItem('token'); 
                    localStorage.removeItem('user');
                    setIsAuthenticated(false);
                }
            } catch (error) {
                console.error("Verification error:", error);
                setIsAuthenticated(false);
            }
        };

        verifyToken();
    }, []);

    if (isAuthenticated === null) {
        return <div style={{ color: '#ffc107', textAlign: 'center', marginTop: '50px' }}>Checking security clearance...</div>;
    }


    return isAuthenticated ? children : <Navigate to="/" replace />;
};

export default ProtectedRoute;