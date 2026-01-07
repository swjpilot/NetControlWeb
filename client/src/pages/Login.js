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
import './Login.css';
import HamRadioBackground from '../assets/HamRadio.jpeg';

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
    <div 
      className="login-container"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.6)), url(${HamRadioBackground})`
      }}
    >
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <Radio size={48} className="text-primary" />
          </div>
          <h1 className="login-title">NetControl</h1>
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
                style={{ 
                  color: '#2d3748', 
                  backgroundColor: 'rgba(255, 255, 255, 0.9)' 
                }}
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
                style={{ 
                  color: '#2d3748', 
                  backgroundColor: 'rgba(255, 255, 255, 0.9)' 
                }}
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
              style={{ color: '#4a5568' }}
            >
              Forgot your password?
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;