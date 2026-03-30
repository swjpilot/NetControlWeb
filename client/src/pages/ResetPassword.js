import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Loader, Check } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await axios.post('/api/auth/reset-password', { token, password });
      setSuccess(true);
      toast.success('Password reset successfully');
      setTimeout(() => navigate('/login'), 3000);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Reset failed');
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="card-body text-center">
            <Lock size={48} className="text-danger mb-3" />
            <h3>Invalid Reset Link</h3>
            <p className="text-muted">This password reset link is invalid or has expired.</p>
            <button className="btn btn-primary" onClick={() => navigate('/login')}>Back to Login</button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
          <div className="card-body text-center">
            <Check size={48} className="text-success mb-3" />
            <h3>Password Reset</h3>
            <p className="text-muted">Your password has been reset. Redirecting to login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="card-header">
          <h3 className="card-title mb-0">
            <Lock size={20} className="me-2" />
            Reset Password
          </h3>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group mb-3">
              <label className="form-label">New Password</label>
              <input type="password" className="form-control" value={password}
                onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </div>
            <div className="form-group mb-3">
              <label className="form-label">Confirm Password</label>
              <input type="password" className="form-control" value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required />
            </div>
            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? <Loader size={16} className="animate-spin me-2" /> : null}
              Reset Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
