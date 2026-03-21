import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { user, loading, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated()) {
    // Redirect to login page with return url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user needs to change password (but allow access to change-password page)
  if (user?.forcePasswordChange && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (requireAdmin && !isAdmin()) {
    return (
      <div className="access-denied">
        <div className="card">
          <div className="card-body text-center">
            <h2>Access Denied</h2>
            <p>You need administrator privileges to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;