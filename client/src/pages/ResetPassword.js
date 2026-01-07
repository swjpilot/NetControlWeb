import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Radio, 
  Lock, 
  Eye, 
  EyeOff,
  ArrowLeft,
  Loader,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [username, setUsername] = useState('');
  const [resetComplete, setResetComplete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('No reset token provided');
      setIsVerifying(false);
      return;
    }

    // Verify token on component mount
    const verifyToken = async () => {
      try {
        const response = await axios.get(`/api/auth/verify-reset-token/${token}`);
        setTokenValid(true);
        setUsername(response.data.username);
      } catch (error) {
        setError(error.response?.data?.error || 'Invalid or expired reset token');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    
    try {
      await axios.post('/api/auth/reset-password', {
        token,
        newPassword: formData.newPassword
      });
      
      setResetComplete(true);
      toast.success('Password reset successfully!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <Loader size={48} className="text-primary animate-spin" />
            </div>
            <h1>Verifying Reset Link</h1>
            <p>Please wait while we verify your reset token...</p>
          </div>
        </div>

        <style jsx>{`
          .login-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 1rem;
          }

          .login-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            padding: 2rem;
            width: 100%;
            max-width: 400px;
          }

          .login-header {
            text-align: center;
            margin-bottom: 2rem;
          }

          .login-logo {
            margin-bottom: 1rem;
          }

          .login-header h1 {
            font-size: 2rem;
            font-weight: 700;
            color: #2c3e50;
            margin: 0 0 0.5rem 0;
          }

          .login-header p {
            color: #6c757d;
            margin: 0;
          }

          .animate-spin {
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !tokenValid) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <AlertCircle size={48} className="text-danger" />
            </div>
            <h1>Invalid Reset Link</h1>
            <p>This password reset link is invalid or has expired</p>
          </div>

          <div className="text-center mb-4">
            <p className="text-muted mb-4">
              {error || 'The password reset link you clicked is invalid or has expired.'}
            </p>
            <p className="text-muted small">
              Password reset links expire after 1 hour for security reasons.
            </p>
          </div>

          <div className="d-flex gap-2">
            <Link to="/forgot-password" className="btn btn-primary flex-fill">
              Request New Reset Link
            </Link>
            <Link to="/login" className="btn btn-outline-secondary flex-fill">
              <ArrowLeft size={16} />
              Back to Login
            </Link>
          </div>
        </div>

        <style jsx>{`
          .login-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 1rem;
          }

          .login-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            padding: 2rem;
            width: 100%;
            max-width: 400px;
          }

          .login-header {
            text-align: center;
            margin-bottom: 2rem;
          }

          .login-logo {
            margin-bottom: 1rem;
          }

          .login-header h1 {
            font-size: 2rem;
            font-weight: 700;
            color: #2c3e50;
            margin: 0 0 0.5rem 0;
          }

          .login-header p {
            color: #6c757d;
            margin: 0;
          }
        `}</style>
      </div>
    );
  }

  if (resetComplete) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <CheckCircle size={48} className="text-success" />
            </div>
            <h1>Password Reset Complete</h1>
            <p>Your password has been successfully updated</p>
          </div>

          <div className="text-center mb-4">
            <p className="mb-4">
              Your password has been successfully reset. You can now log in with your new password.
            </p>
          </div>

          <Link to="/login" className="btn btn-primary w-100">
            Continue to Login
          </Link>
        </div>

        <style jsx>{`
          .login-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 1rem;
          }

          .login-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            padding: 2rem;
            width: 100%;
            max-width: 400px;
          }

          .login-header {
            text-align: center;
            margin-bottom: 2rem;
          }

          .login-logo {
            margin-bottom: 1rem;
          }

          .login-header h1 {
            font-size: 2rem;
            font-weight: 700;
            color: #2c3e50;
            margin: 0 0 0.5rem 0;
          }

          .login-header p {
            color: #6c757d;
            margin: 0;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <Radio size={48} className="text-primary" />
          </div>
          <h1>Reset Password</h1>
          <p>Create a new password for {username}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">New Password</label>
            <div className="input-group">
              <span className="input-group-text">
                <Lock size={16} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="newPassword"
                className="form-control"
                placeholder="Enter new password"
                value={formData.newPassword}
                onChange={handleChange}
                required
                autoFocus
              />
              <button
                type="button"
                className="input-group-button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="form-text">
              Password must be at least 6 characters long.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <div className="input-group">
              <span className="input-group-text">
                <Lock size={16} />
              </span>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                className="form-control"
                placeholder="Confirm new password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="input-group-button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100 mb-3"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader size={16} className="animate-spin" />
                Resetting Password...
              </>
            ) : (
              <>
                <Lock size={16} />
                Reset Password
              </>
            )}
          </button>

          <Link to="/login" className="btn btn-outline-secondary w-100">
            <ArrowLeft size={16} />
            Back to Login
          </Link>
        </form>
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 1rem;
        }

        .login-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          padding: 2rem;
          width: 100%;
          max-width: 400px;
        }

        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .login-logo {
          margin-bottom: 1rem;
        }

        .login-header h1 {
          font-size: 2rem;
          font-weight: 700;
          color: #2c3e50;
          margin: 0 0 0.5rem 0;
        }

        .login-header p {
          color: #6c757d;
          margin: 0;
        }

        .login-form {
          margin-bottom: 2rem;
        }

        .input-group-button {
          background: none;
          border: none;
          padding: 0.5rem 0.75rem;
          color: #6c757d;
          cursor: pointer;
          border-left: 1px solid #ced4da;
        }

        .input-group-button:hover {
          color: #495057;
        }

        .form-text {
          font-size: 0.875rem;
          color: #6c757d;
          margin-top: 0.5rem;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 480px) {
          .login-card {
            padding: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default ResetPassword;