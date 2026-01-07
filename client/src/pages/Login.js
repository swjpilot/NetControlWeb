import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Radio, 
  User, 
  Lock, 
  LogIn, 
  Eye, 
  EyeOff,
  Loader
} from 'lucide-react';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const from = location.state?.from?.pathname || '/';

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    const result = await login(formData.username, formData.password);
    
    if (result.success) {
      navigate(from, { replace: true });
    }
    
    setIsLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <Radio size={48} className="text-primary" />
          </div>
          <h1>NetControl</h1>
          <p>Ham Radio Net Management</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="input-group">
              <span className="input-group-text">
                <User size={16} />
              </span>
              <input
                type="text"
                name="username"
                className="form-control"
                placeholder="Enter your username"
                value={formData.username}
                onChange={handleChange}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-group">
              <span className="input-group-text">
                <Lock size={16} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                className="form-control"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="input-group-button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader size={16} className="animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn size={16} />
                Sign In
              </>
            )}
          </button>

          <div className="text-center mt-3">
            <a 
              href="/forgot-password" 
              className="text-decoration-none small"
              style={{ color: '#6c757d' }}
            >
              Forgot your password?
            </a>
          </div>
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

        .login-footer {
          border-top: 1px solid #e9ecef;
          padding-top: 1.5rem;
        }

        .login-info {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 1rem;
          text-align: center;
        }

        .login-info h4 {
          font-size: 1rem;
          font-weight: 600;
          color: #495057;
          margin: 0 0 0.5rem 0;
        }

        .login-info p {
          margin: 0.25rem 0;
          font-size: 0.875rem;
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

export default Login;