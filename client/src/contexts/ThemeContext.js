import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Get theme from localStorage as fallback
    return localStorage.getItem('netcontrol_theme') || 'light';
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from database on mount
  useEffect(() => {
    const loadThemeFromDatabase = async () => {
      try {
        const token = localStorage.getItem('netcontrol_token');
        if (token) {
          const response = await axios.get('/api/settings', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          const dbTheme = response.data.settings.theme;
          if (dbTheme && dbTheme !== theme) {
            setTheme(dbTheme);
            localStorage.setItem('netcontrol_theme', dbTheme);
          }
        }
      } catch (error) {
        console.log('Could not load theme from database, using localStorage fallback');
      } finally {
        setIsLoading(false);
      }
    };

    loadThemeFromDatabase();
  }, []);

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme);
    
    // Save theme to localStorage
    localStorage.setItem('netcontrol_theme', theme);
  }, [theme]);

  const changeTheme = async (newTheme) => {
    setTheme(newTheme);
    
    // Also update in database if user is logged in
    try {
      const token = localStorage.getItem('netcontrol_token');
      if (token) {
        await axios.put('/api/settings', {
          settings: { theme: newTheme }
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Failed to save theme to database:', error);
    }
  };

  const value = {
    theme,
    changeTheme,
    isLoading,
    isDark: theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};