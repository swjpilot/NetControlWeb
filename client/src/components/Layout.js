import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Users, 
  Calendar, 
  Radio, 
  Database, 
  FileText, 
  Settings,
  Activity,
  LogOut,
  User,
  Shield,
  ChevronDown,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import VersionFooter from './VersionFooter';

const Layout = ({ children }) => {
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { theme, changeTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/sessions', label: 'Net Sessions', icon: Calendar },
    { path: '/operators', label: 'Operators', icon: Users },
    { path: '/qrz', label: 'QRZ Lookup', icon: Radio },
    { path: '/fcc', label: 'FCC Database', icon: Database },
    { path: '/reports', label: 'Reports', icon: FileText },
    ...(isAdmin() ? [
      { path: '/users', label: 'User Management', icon: Shield },
      { path: '/settings', label: 'Settings', icon: Settings }
    ] : []),
  ];

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
  };

  const handleThemeChange = (newTheme) => {
    changeTheme(newTheme);
    setShowUserMenu(false);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light': return Sun;
      case 'dark': return Moon;
      case 'auto': return Monitor;
      default: return Sun;
    }
  };

  const ThemeIcon = getThemeIcon();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>NetControl</h1>
          <p>Ham Radio Net Management</p>
          <div className="status status-online">
            <Activity size={12} />
            Connected
          </div>
        </div>
        <nav>
          <ul className="nav-menu">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <li key={item.path} className="nav-item">
                  <Link 
                    to={item.path} 
                    className={`nav-link ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={20} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Menu */}
        <div className="sidebar-footer">
          <div className="user-menu">
            <button 
              className="user-menu-trigger"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="user-info">
                <div className="user-avatar">
                  <User size={16} />
                </div>
                <div className="user-details">
                  <div className="user-name">{user?.name || user?.username}</div>
                  <div className="user-role">
                    {user?.role === 'admin' ? (
                      <>
                        <Shield size={12} />
                        Admin
                      </>
                    ) : (
                      'User'
                    )}
                  </div>
                </div>
                <div className="theme-indicator">
                  <ThemeIcon size={14} />
                </div>
              </div>
              <ChevronDown size={16} className={`chevron ${showUserMenu ? 'open' : ''}`} />
            </button>
            
            {showUserMenu && (
              <div className="user-dropdown">
                <Link to="/profile" className="dropdown-item">
                  <User size={16} />
                  Profile
                </Link>
                
                {/* Theme Switcher */}
                <div className="dropdown-divider"></div>
                <div className="dropdown-header">Theme</div>
                <button 
                  onClick={() => handleThemeChange('light')} 
                  className={`dropdown-item ${theme === 'light' ? 'active' : ''}`}
                >
                  <Sun size={16} />
                  Light
                </button>
                <button 
                  onClick={() => handleThemeChange('dark')} 
                  className={`dropdown-item ${theme === 'dark' ? 'active' : ''}`}
                >
                  <Moon size={16} />
                  Dark
                </button>
                <button 
                  onClick={() => handleThemeChange('auto')} 
                  className={`dropdown-item ${theme === 'auto' ? 'active' : ''}`}
                >
                  <Monitor size={16} />
                  Auto
                </button>
                
                <div className="dropdown-divider"></div>
                <button onClick={handleLogout} className="dropdown-item logout">
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
          
          {/* Version Footer */}
          <VersionFooter />
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;