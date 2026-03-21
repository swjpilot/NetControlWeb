import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';

const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await axios.post('/api/auth/change-password', {
        currentPassword,
        newPassword
      });

      toast.success('Password changed successfully');
      
      // Update user context to clear force password change flag
      if (user) {
        updateUser({ ...user, forcePasswordChange: false });
      }
      
      // Redirect to home
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const isForced = user?.forcePasswordChange;

  return (
    <div className="container" style={{ maxWidth: '500px', marginTop: '50px' }}>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title d-flex align-items-center">
            <Lock size={24} className="me-2" />
            Change Password
          </h2>
        </div>
        <div className="card-body">
          {isForced && (
            <div className="alert alert-warning d-flex align-items-start mb-4">
              <AlertCircle size={20} className="me-2 mt-1" />
              <div>
                <strong>Password Change Required</strong>
                <p className="mb-0 mt-1">
                  Your administrator has required you to change your password before continuing.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Current Password</label>
              <input
                type="password"
                className="form-control"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="mb-3">
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-control"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
              <small className="text-muted">Minimum 6 characters</small>
            </div>

            <div className="mb-3">
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="alert alert-danger">{error}</div>
            )}

            <div className="d-flex gap-2">
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Changing Password...' : 'Change Password'}
              </button>
              {!isForced && (
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
