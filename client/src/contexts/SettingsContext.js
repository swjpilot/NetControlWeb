import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load settings from database
  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('netcontrol_token');
      if (token) {
        const response = await axios.get('/api/settings', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const dbSettings = response.data.settings;
        setSettings(dbSettings);
        
        // Sync important settings to localStorage for offline access
        if (dbSettings.theme) {
          localStorage.setItem('netcontrol_theme', dbSettings.theme);
        }
        if (dbSettings.items_per_page) {
          localStorage.setItem('netcontrol_items_per_page', dbSettings.items_per_page);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setError(error.message);
      
      // Fallback to localStorage values
      const fallbackSettings = {
        theme: localStorage.getItem('netcontrol_theme') || 'light',
        items_per_page: localStorage.getItem('netcontrol_items_per_page') || '25'
      };
      setSettings(fallbackSettings);
    } finally {
      setIsLoading(false);
    }
  };

  // Update settings in database
  const updateSettings = async (newSettings) => {
    try {
      const token = localStorage.getItem('netcontrol_token');
      if (token) {
        await axios.put('/api/settings', {
          settings: newSettings
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Update local state
        setSettings(prev => ({ ...prev, ...newSettings }));
        
        // Sync to localStorage
        if (newSettings.theme) {
          localStorage.setItem('netcontrol_theme', newSettings.theme);
        }
        if (newSettings.items_per_page) {
          localStorage.setItem('netcontrol_items_per_page', newSettings.items_per_page);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  };

  // Get a specific setting with fallback
  const getSetting = (key, defaultValue = null) => {
    return settings[key] || localStorage.getItem(`netcontrol_${key}`) || defaultValue;
  };

  // Load settings on mount and when token changes
  useEffect(() => {
    loadSettings();
  }, []);

  // Listen for storage changes (when settings are updated in another tab)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key?.startsWith('netcontrol_')) {
        loadSettings();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const value = {
    settings,
    isLoading,
    error,
    loadSettings,
    updateSettings,
    getSetting
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};