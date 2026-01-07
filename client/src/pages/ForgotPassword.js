import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Radio, 
  Mail, 
  ArrowLeft,
  Loader,
  CheckCircle
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await axios.post('/api/auth/forgot-password', { email });
      setEmailSent(true);
      toast.success('Password reset instructions sent!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <CheckCircle size={48} className="text-success" />
            </div>
            <h1>Check Your Email</h1>
            <p>Password reset instructions sent</p>
          </div>

          <div className="text-center mb-4">
            <p className="mb-3">
              We've sent password reset instructions to <strong>{email}</strong>
            </p>
            <p className="text-muted small mb-4">
              Check your email and click the reset link to create a new password. 
              The link will expire in 1 hour.
            </p>
            <p className="text-muted small">
              Didn't receive the email? Check your spam folder or try again with a different email address.
            </p>
          </div>

          <div className="d-flex gap-2">
            <Link to="/login" className="btn btn-outline-primary flex-fill">
              <ArrowLeft size={16} />
              Back to Login
            </Link>
            <button 
              className="btn btn-secondary flex-fill"
              onClick={() => {
                setEmailSent(false);
                setEmail('');
              }}
            >
              Try Different Email
            </button>
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

          @media (max-width: 480px) {
            .login-card {
              padding: 1.5rem;
            }
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
          <h1>Forgot Password</h1>
          <p>Enter your email to reset your password</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-group">
              <span className="input-group-text">
                <Mail size={16} />
              </span>
              <input
                type="email"
                className="form-control"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-text">
              We'll send password reset instructions to this email address.
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
                Sending...
              </>
            ) : (
              <>
                <Mail size={16} />
                Send Reset Instructions
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

export default ForgotPassword;