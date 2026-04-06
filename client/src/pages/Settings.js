import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Settings as SettingsIcon, 
  Save, 
  TestTube, 
  RotateCcw, 
  Shield, 
  Mail, 
  Database, 
  Palette, 
  Radio,
  Check,
  X,
  Loader,
  AlertTriangle,
  Send,
  Link,
  Download,
  Upload
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import axios from 'axios';
import toast from 'react-hot-toast';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('qrz');
  const [testResults, setTestResults] = useState({});
  const queryClient = useQueryClient();
  const { theme, changeTheme } = useTheme();
  const { loadSettings } = useSettings();

  // Separate forms for each tab
  const qrzForm = useForm();
  const appForm = useForm();
  const emailForm = useForm();
  const databaseForm = useForm();
  const uiForm = useForm();
  const securityForm = useForm();
  const integrationForm = useForm();

  // Map tabs to their respective forms
  const tabForms = {
    qrz: qrzForm,
    app: appForm,
    email: emailForm,
    database: databaseForm,
    ui: uiForm,
    security: securityForm,
    integration: integrationForm
  };

  // Get current form based on active tab
  const currentForm = tabForms[activeTab];

  // Fetch current settings
  const { isLoading } = useQuery(
    'settings',
    () => axios.get('/api/settings').then(res => res.data.settings),
    {
      onSuccess: (data) => {
        // Populate all forms with current settings
        Object.entries(tabForms).forEach(([tabName, form]) => {
          Object.entries(data).forEach(([key, value]) => {
            form.setValue(key, value);
          });
          // Set current theme if not in settings
          if (!data.theme) {
            form.setValue('theme', theme);
          }
        });
      }
    }
  );

  // Update settings mutation
  const updateSettingsMutation = useMutation(
    (data) => axios.put('/api/settings', { settings: data }),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('settings');
        // Refresh settings context
        loadSettings();
        toast.success('Settings updated successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to update settings');
      }
    }
  );

  // Test QRZ connection mutation
  const testQRZMutation = useMutation(
    (credentials) => axios.post('/api/settings/test-qrz', credentials),
    {
      onSuccess: (response) => {
        setTestResults(prev => ({
          ...prev,
          qrz: response.data
        }));
        if (response.data.success) {
          toast.success('QRZ connection successful');
        } else {
          toast.error(response.data.message);
        }
      },
      onError: (error) => {
        const message = error.response?.data?.error || 'QRZ test failed';
        setTestResults(prev => ({
          ...prev,
          qrz: { success: false, message }
        }));
        toast.error(message);
      }
    }
  );

  // Test SMTP connection mutation
  const testSMTPMutation = useMutation(
    (smtpConfig) => axios.post('/api/settings/test-smtp', smtpConfig),
    {
      onSuccess: (response) => {
        setTestResults(prev => ({
          ...prev,
          smtp: response.data
        }));
        if (response.data.success) {
          toast.success('SMTP connection successful');
        } else {
          toast.error(response.data.message);
        }
      },
      onError: (error) => {
        const message = error.response?.data?.error || 'SMTP test failed';
        setTestResults(prev => ({
          ...prev,
          smtp: { success: false, message }
        }));
        toast.error(message);
      }
    }
  );

  // Send test email mutation
  const sendTestEmailMutation = useMutation(
    (email) => axios.post('/api/settings/send-test-email', { email }),
    {
      onSuccess: (response) => {
        setTestResults(prev => ({
          ...prev,
          testEmail: response.data
        }));
        if (response.data.success) {
          toast.success(response.data.message);
        } else {
          toast.error(response.data.message);
        }
      },
      onError: (error) => {
        const message = error.response?.data?.error || 'Failed to send test email';
        setTestResults(prev => ({
          ...prev,
          testEmail: { success: false, message }
        }));
        toast.error(message);
      }
    }
  );

  // Reset settings mutation
  const resetSettingsMutation = useMutation(
    (category) => axios.post('/api/settings/reset', { category }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('settings');
        toast.success('Settings reset successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to reset settings');
      }
    }
  );

  // Form submission handlers for each tab
  const onSubmit = (data) => {
    // Handle theme change immediately
    if (data.theme && data.theme !== theme) {
      changeTheme(data.theme);
    }
    
    // Filter data to only include relevant fields for the current tab
    const filteredData = filterDataForTab(data, activeTab);
    updateSettingsMutation.mutate(filteredData);
  };

  const onError = (errors) => {
    console.log('Form validation errors:', errors);
    toast.error('Please fix form validation errors');
  };

  // Filter data based on the active tab
  const filterDataForTab = (data, tab) => {
    const tabFields = {
      qrz: ['qrz_username', 'qrz_password'],
      app: ['app_name', 'app_description', 'default_net_control', 'default_net_frequency', 'default_net_time', 'default_net_power', 'default_grid_square', 'distance_unit'],
      email: ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_starttls', 'smtp_no_auth', 'smtp_username', 'smtp_password', 'smtp_from_email', 'smtp_from_name'],
      database: ['auto_backup_enabled', 'auto_backup_interval', 'backup_time', 'backup_s3_bucket', 'backup_s3_prefix', 'auto_backup_s3_enabled', 'backup_retention_count'],
      ui: ['theme', 'items_per_page'],
      security: ['session_timeout', 'require_password_change', 'min_password_length'],
      integration: ['precheckin_url', 'netreport_url', 'net_script_template', 'arrl_section_email', 'monthly_report_enabled', 'monthly_report_day', 'monthly_report_time', 'monthly_report_timezone', 'monthly_report_callsign']
    };

    const relevantFields = tabFields[tab] || [];
    const filteredData = {};
    
    relevantFields.forEach(field => {
      if (data[field] !== undefined) {
        filteredData[field] = data[field];
      }
    });

    return filteredData;
  };

  const handleTestQRZ = () => {
    const username = qrzForm.watch('qrz_username');
    const password = qrzForm.watch('qrz_password');
    
    if (!username || !password) {
      toast.error('Please enter QRZ username and password');
      return;
    }
    
    testQRZMutation.mutate({ username, password });
  };

  const handleTestSMTP = () => {
    const smtpConfig = {
      host: emailForm.watch('smtp_host'),
      port: emailForm.watch('smtp_port'),
      secure: emailForm.watch('smtp_secure'),
      starttls: emailForm.watch('smtp_starttls'),
      noAuth: emailForm.watch('smtp_no_auth'),
      username: emailForm.watch('smtp_username'),
      password: emailForm.watch('smtp_password'),
      fromEmail: emailForm.watch('smtp_from_email')
    };
    
    if (!smtpConfig.host || !smtpConfig.port) {
      toast.error('Please fill in SMTP host and port');
      return;
    }
    
    if (!smtpConfig.noAuth && (!smtpConfig.username || !smtpConfig.password)) {
      toast.error('Please fill in username and password, or enable "No authentication required"');
      return;
    }
    
    testSMTPMutation.mutate(smtpConfig);
  };

  const handleSendTestEmail = () => {
    const email = prompt('Enter email address to send test email to:');
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendTestEmailMutation.mutate(email);
    } else if (email) {
      toast.error('Please enter a valid email address');
    }
  };

  const handleReset = (category) => {
    const categoryNames = {
      qrz: 'QRZ settings',
      smtp: 'SMTP settings',
      all: 'all settings'
    };
    
    if (window.confirm(`Are you sure you want to reset ${categoryNames[category]}? This cannot be undone.`)) {
      resetSettingsMutation.mutate(category);
    }
  };

  const tabs = [
    { id: 'qrz', label: 'QRZ Integration', icon: Radio },
    { id: 'app', label: 'Application', icon: SettingsIcon },
    { id: 'email', label: 'Email/SMTP', icon: Mail },
    { id: 'integration', label: 'External Services', icon: Link },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'ui', label: 'User Interface', icon: Palette },
    { id: 'security', label: 'Security', icon: Shield }
  ];

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>
          <SettingsIcon size={24} className="me-2" />
          Application Settings
        </h1>
        <div className="d-flex gap-2">
          <button 
            className="btn btn-outline-danger"
            onClick={() => handleReset('all')}
            disabled={resetSettingsMutation.isLoading}
          >
            <RotateCcw size={16} />
            Reset All
          </button>
        </div>
      </div>

      <div className="row">
        {/* Settings Navigation */}
        <div className="col-md-3">
          <div className="card">
            <div className="card-body p-0">
              <div className="nav nav-pills flex-column">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      className={`nav-link text-start ${activeTab === tab.id ? 'active' : ''}`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <Icon size={16} className="me-2" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Settings Content */}
        <div className="col-md-9">
          <form onSubmit={currentForm.handleSubmit(onSubmit, onError)}>
            <div className="card">
              <div className="card-body">
                
                {/* QRZ Settings */}
                {activeTab === 'qrz' && (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h3>QRZ Integration Settings</h3>
                      <div className="d-flex gap-2">
                        <button 
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={handleTestQRZ}
                          disabled={testQRZMutation.isLoading}
                        >
                          {testQRZMutation.isLoading ? (
                            <Loader size={14} className="animate-spin" />
                          ) : (
                            <TestTube size={14} />
                          )}
                          Test Connection
                        </button>
                        <button 
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleReset('qrz')}
                        >
                          <RotateCcw size={14} />
                          Reset
                        </button>
                      </div>
                    </div>

                    {testResults.qrz && (
                      <div className={`alert ${testResults.qrz.success ? 'alert-success' : 'alert-danger'} mb-3`}>
                        <div className="d-flex align-items-center">
                          {testResults.qrz.success ? (
                            <Check size={16} className="me-2 text-success" />
                          ) : (
                            <X size={16} className="me-2 text-danger" />
                          )}
                          {testResults.qrz.message}
                        </div>
                      </div>
                    )}

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">QRZ Username</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Your QRZ.com username"
                          {...currentForm.register('qrz_username')}
                        />
                        <div className="form-text">
                          Your QRZ.com account username for XML API access
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">QRZ Password</label>
                        <input
                          type="password"
                          className="form-control"
                          placeholder="Your QRZ.com password"
                          {...currentForm.register('qrz_password')}
                        />
                        <div className="form-text">
                          Your QRZ.com account password (stored securely)
                        </div>
                      </div>
                    </div>

                    <div className="alert alert-info">
                      <AlertTriangle size={16} className="me-2" />
                      <strong>Note:</strong> QRZ XML API access requires a QRZ.com subscription. 
                      These credentials will be used for all callsign lookups in the application.
                    </div>
                  </div>
                )}

                {/* Application Settings */}
                {activeTab === 'app' && (
                  <div>
                    <h3 className="mb-3">Application Settings</h3>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Application Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="NetControl"
                          {...currentForm.register('app_name')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Application Description</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Ham Radio Net Management"
                          {...currentForm.register('app_description')}
                        />
                      </div>
                    </div>

                    <h4 className="mt-4 mb-3">Default Net Settings</h4>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Default Net Control</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g., W1AW"
                          {...currentForm.register('default_net_control')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Default Frequency</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g., 146.520 MHz"
                          {...currentForm.register('default_net_frequency')}
                        />
                      </div>
                    </div>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Default Net Time</label>
                        <input
                          type="time"
                          className="form-control"
                          {...currentForm.register('default_net_time')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Default Power</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g., 50W"
                          {...currentForm.register('default_net_power')}
                        />
                      </div>
                    </div>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Default Grid Square</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g., FN31pr"
                          {...currentForm.register('default_grid_square')}
                          maxLength="10"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Distance Unit</label>
                        <select className="form-control" {...currentForm.register('distance_unit')}>
                          <option value="miles">Miles</option>
                          <option value="kilometers">Kilometers</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Email/SMTP Settings */}
                {activeTab === 'email' && (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h3>Email/SMTP Settings</h3>
                      <div className="d-flex gap-2">
                        <button 
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={handleTestSMTP}
                          disabled={testSMTPMutation.isLoading}
                        >
                          {testSMTPMutation.isLoading ? (
                            <Loader size={14} className="animate-spin" />
                          ) : (
                            <TestTube size={14} />
                          )}
                          Test SMTP
                        </button>
                        <button 
                          type="button"
                          className="btn btn-outline-success btn-sm"
                          onClick={handleSendTestEmail}
                          disabled={sendTestEmailMutation.isLoading}
                        >
                          {sendTestEmailMutation.isLoading ? (
                            <Loader size={14} className="animate-spin" />
                          ) : (
                            <Send size={14} />
                          )}
                          Send Test Email
                        </button>
                        <button 
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleReset('smtp')}
                        >
                          <RotateCcw size={14} />
                          Reset
                        </button>
                      </div>
                    </div>

                    {testResults.smtp && (
                      <div className={`alert ${testResults.smtp.success ? 'alert-success' : 'alert-danger'} mb-3`}>
                        <div className="d-flex align-items-center">
                          {testResults.smtp.success ? (
                            <Check size={16} className="me-2 text-success" />
                          ) : (
                            <X size={16} className="me-2 text-danger" />
                          )}
                          {testResults.smtp.message}
                        </div>
                      </div>
                    )}

                    {testResults.testEmail && (
                      <div className={`alert ${testResults.testEmail.success ? 'alert-success' : 'alert-danger'} mb-3`}>
                        <div className="d-flex align-items-center">
                          {testResults.testEmail.success ? (
                            <Check size={16} className="me-2 text-success" />
                          ) : (
                            <X size={16} className="me-2 text-danger" />
                          )}
                          {testResults.testEmail.message}
                        </div>
                      </div>
                    )}

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">SMTP Host</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="smtp.gmail.com"
                          {...currentForm.register('smtp_host')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">SMTP Port</label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="587"
                          {...currentForm.register('smtp_port')}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          {...currentForm.register('smtp_secure')}
                        />
                        <label className="form-check-label">
                          Use SSL/TLS (recommended for port 465)
                        </label>
                      </div>
                    </div>

                    <div className="form-group">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          {...currentForm.register('smtp_starttls')}
                        />
                        <label className="form-check-label">
                          Use STARTTLS (recommended for port 587)
                        </label>
                      </div>
                      <div className="form-text">
                        STARTTLS upgrades a plain text connection to encrypted. Common for modern email providers.
                      </div>
                    </div>

                    <div className="form-group">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          {...currentForm.register('smtp_no_auth')}
                        />
                        <label className="form-check-label">
                          No authentication required (for local/internal mail servers)
                        </label>
                      </div>
                    </div>

                    {!currentForm.watch('smtp_no_auth') && (
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">SMTP Username</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="your-email@gmail.com"
                            {...currentForm.register('smtp_username')}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">SMTP Password</label>
                          <input
                            type="password"
                            className="form-control"
                            placeholder="Your email password or app password"
                            {...currentForm.register('smtp_password')}
                          />
                        </div>
                      </div>
                    )}

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">From Email</label>
                        <input
                          type="email"
                          className="form-control"
                          placeholder="netcontrol@yourclub.org"
                          {...currentForm.register('smtp_from_email')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">From Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="NetControl System"
                          {...currentForm.register('smtp_from_name')}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Database Settings */}
                {activeTab === 'database' && (
                  <div>
                    <h3 className="mb-3">Database Settings</h3>
                    
                    <div className="form-group">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          {...currentForm.register('auto_backup_enabled')}
                        />
                        <label className="form-check-label">
                          Enable automatic database backups
                        </label>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Backup Interval (hours)</label>
                      <input
                        type="number"
                        className="form-control"
                        min="1"
                        max="168"
                        placeholder="24"
                        {...currentForm.register('auto_backup_interval')}
                      />
                      <div className="form-text">
                        How often to create automatic backups (1-168 hours)
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Backup Time</label>
                      <input
                        type="time"
                        className="form-control"
                        {...currentForm.register('backup_time')}
                      />
                      <div className="form-text">
                        Time of day to run the backup (uses app timezone). Only applies when interval is 24h or more.
                      </div>
                    </div>

                    <h4 className="mt-4 mb-3">S3 Backup Storage</h4>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">S3 Bucket Name</label>
                        <input type="text" className="form-control" placeholder="my-backup-bucket" {...currentForm.register('backup_s3_bucket')} />
                        <div className="form-text">Uses the EB instance IAM role for authentication</div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">S3 Key Prefix</label>
                        <input type="text" className="form-control" placeholder="netcontrol-backups/" {...currentForm.register('backup_s3_prefix')} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <div className="form-check mt-2">
                          <input type="checkbox" className="form-check-input" {...currentForm.register('auto_backup_s3_enabled')} />
                          <label className="form-check-label">Automatically backup to S3 on schedule</label>
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Backups to Keep</label>
                        <input type="number" className="form-control" min="1" max="100" placeholder="10" {...currentForm.register('backup_retention_count')} />
                        <div className="form-text">Oldest S3 backups beyond this count are automatically deleted</div>
                      </div>
                    </div>

                    <DatabaseBackupPanel />
                  </div>
                )}

                {/* UI Settings */}
                {activeTab === 'ui' && (
                  <div>
                    <h3 className="mb-3">User Interface Settings</h3>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Theme</label>
                        <select className="form-control" {...currentForm.register('theme')}>
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                          <option value="auto">Auto (system preference)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Items per Page</label>
                        <input
                          type="number"
                          className="form-control"
                          min="10"
                          max="500"
                          placeholder="50"
                          {...currentForm.register('items_per_page')}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Security Settings */}
                {activeTab === 'security' && (
                  <div>
                    <h3 className="mb-3">Security Settings</h3>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Session Timeout (hours)</label>
                        <input
                          type="number"
                          className="form-control"
                          min="1"
                          max="168"
                          placeholder="24"
                          {...currentForm.register('session_timeout')}
                        />
                        <div className="form-text">
                          How long users stay logged in (1-168 hours)
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Minimum Password Length</label>
                        <input
                          type="number"
                          className="form-control"
                          min="6"
                          max="50"
                          placeholder="6"
                          {...currentForm.register('min_password_length')}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          {...currentForm.register('require_password_change')}
                        />
                        <label className="form-check-label">
                          Require users to change password on first login
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Integration Settings */}
                {activeTab === 'integration' && (
                  <div>
                    <h3 className="mb-3">External Services Integration</h3>
                    
                    <h4 className="mt-4 mb-3">BRARS Pre-Net Check-In</h4>
                    <div className="form-group">
                      <label className="form-label">Pre-Check-In URL</label>
                      <input
                        type="url"
                        className="form-control"
                        placeholder="https://brars.hamsunite.org/api/pre-checkin"
                        {...currentForm.register('precheckin_url')}
                      />
                      <div className="form-text">
                        URL to fetch pre-check-in participant data from BRARS website
                      </div>
                    </div>

                    <h4 className="mt-4 mb-3">Net Report Submission</h4>
                    <div className="form-group">
                      <label className="form-label">Net Report URL</label>
                      <input
                        type="url"
                        className="form-control"
                        placeholder="https://brars.hamsunite.org/cgi-bin/netReport"
                        {...currentForm.register('netreport_url')}
                      />
                      <div className="form-text">
                        Base URL for net report submission. Parameters (callsign, date, check-ins, etc.) are appended automatically.
                      </div>
                    </div>

                    <div className="alert alert-info">
                      <AlertTriangle size={16} className="me-2" />
                      <strong>Note:</strong> These URLs connect to external services for pre-check-in data 
                      and net report submission. Ensure the URLs are correct and the services are accessible.
                    </div>

                    <h4 className="mt-4 mb-3">Net Script Template</h4>
                    <div className="form-group">
                      <label className="form-label">Script Template</label>
                      <textarea
                        className="form-control"
                        rows="12"
                        placeholder={"Good evening, this is {CALLSIGN}, {FIRSTNAME}..."}
                        style={{ fontFamily: 'monospace', fontSize: '0.9rem', whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflowWrap: 'break-word' }}
                        {...currentForm.register('net_script_template')}
                      />
                      <div className="form-text">
                        Write your net script here. Use the following variables that will be replaced with session data:
                      </div>
                      <div className="mt-2" style={{ maxWidth: '100%', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {[
                            { var: '{FIRSTNAME}', desc: 'NC first name' },
                            { var: '{FULLNAME}', desc: 'NC full name' },
                            { var: '{CALLSIGN}', desc: 'NC call sign' },
                            { var: '{CITY}', desc: 'NC city' },
                            { var: '{DATE}', desc: 'Session date' },
                            { var: '{DAY_OF_WEEK}', desc: 'Day of week' },
                            { var: '{STARTING_GROUP}', desc: 'Starting group' },
                            { var: '{GROUP_1}', desc: '1st group' },
                            { var: '{GROUP_2}', desc: '2nd group' },
                            { var: '{GROUP_3}', desc: '3rd group' },
                            { var: '{GROUP_4}', desc: '4th group' },
                            { var: '{GROUP_5}', desc: '5th group' },
                            { var: '{GROUP_6}', desc: '6th group' },
                            { var: '{GROUP_CHECKLIST}', desc: 'Interactive checkboxes' },
                            { var: '{FREQUENCY}', desc: 'Frequency' },
                            { var: '{MODE}', desc: 'Mode' },
                            { var: '{NET_TYPE}', desc: 'Net type' },
                            { var: '{CHECKINS}', desc: 'Check-ins' },
                            { var: '{TRAFFIC}', desc: 'Traffic' },
                            { var: '{START_TIME}', desc: 'Start time' },
                            { var: '{END_TIME}', desc: 'End time' },
                            { var: '{POWER}', desc: 'Power' },
                            { var: '{ANTENNA}', desc: 'Antenna' },
                            { var: '{TOMORROW_FIRSTNAME}', desc: "Tomorrow NC" },
                            { var: '{TOMORROW_CALLSIGN}', desc: "Tomorrow call" },
                            { var: '[i]...[/i]', desc: 'Italic' },
                            { var: '[b]...[/b]', desc: 'Bold' },
                          ].map(v => (
                            <span key={v.var} className="badge bg-secondary" style={{ fontSize: '0.7rem', fontFamily: 'monospace', display: 'inline-block' }}>
                              {v.var} <small className="opacity-75">= {v.desc}</small>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <h4 className="mt-4 mb-3">ARRL Monthly Report</h4>
                    <div className="form-group">
                      <label className="form-label">Section Manager Email</label>
                      <input type="text" className="form-control" placeholder="sm@arrl.org, you@hamsonair.com" {...currentForm.register('arrl_section_email')} />
                      <div className="form-text">Comma-separated for multiple recipients</div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Reporting Call Sign</label>
                      <input type="text" className="form-control" placeholder="W1AW" style={{ textTransform: 'uppercase' }} {...currentForm.register('monthly_report_callsign')} />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <div className="form-check">
                          <input type="checkbox" className="form-check-input" {...currentForm.register('monthly_report_enabled')} />
                          <label className="form-check-label">Enable automatic monthly report</label>
                        </div>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Day of Month to Send</label>
                        <input type="number" className="form-control" min="1" max="28" placeholder="1" {...currentForm.register('monthly_report_day')} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Time to Send</label>
                        <input type="time" className="form-control" {...currentForm.register('monthly_report_time')} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Timezone</label>
                        <select className="form-control" {...currentForm.register('monthly_report_timezone')}>
                          <option value="America/New_York">Eastern</option>
                          <option value="America/Chicago">Central</option>
                          <option value="America/Denver">Mountain</option>
                          <option value="America/Los_Angeles">Pacific</option>
                          <option value="UTC">UTC</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

              </div>
              
              <div className="card-footer">
                <div className="d-flex justify-content-end gap-2">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => currentForm.reset()}
                  >
                    Reset Form
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={updateSettingsMutation.isLoading}
                  >
                    {updateSettingsMutation.isLoading ? (
                      <>
                        <Loader size={16} className="animate-spin me-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} className="me-2" />
                        Save {tabs.find(tab => tab.id === activeTab)?.label} Settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const DatabaseBackupPanel = () => {
  const [s3Backups, setS3Backups] = React.useState([]);
  const [s3Loading, setS3Loading] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState('');
  const fileInputRef = React.useRef(null);

  const handleDownload = async () => {
    setActionLoading('download');
    try {
      const token = localStorage.getItem('netcontrol_token');
      const response = await axios.get('/api/backup/export', { headers: { Authorization: 'Bearer ' + token }, responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a'); a.href = url;
      a.download = 'netcontrol-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click(); window.URL.revokeObjectURL(url);
      toast.success('Backup downloaded');
    } catch (e) { toast.error(e.response?.data?.error || 'Download failed'); }
    setActionLoading('');
  };

  const handleUploadRestore = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (!window.confirm('This will REPLACE all data. Are you sure?')) { e.target.value = ''; return; }
    setActionLoading('upload');
    try {
      const formData = new FormData(); formData.append('backup', file);
      const token = localStorage.getItem('netcontrol_token');
      const res = await axios.post('/api/backup/restore', formData, { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'multipart/form-data' } });
      const summary = Object.entries(res.data.results).map(([t, v]) => t + ': ' + v.restored).join(', ');
      toast.success('Restored: ' + summary, { duration: 6000 });
    } catch (e) { toast.error(e.response?.data?.error || 'Restore failed'); }
    e.target.value = ''; setActionLoading('');
  };

  const handleS3Upload = async () => {
    setActionLoading('s3upload');
    try {
      const token = localStorage.getItem('netcontrol_token');
      const res = await axios.post('/api/backup/s3/upload', {}, { headers: { Authorization: 'Bearer ' + token } });
      toast.success('Backup uploaded to S3: ' + res.data.key); loadS3Backups();
    } catch (e) { toast.error(e.response?.data?.error || 'S3 upload failed'); }
    setActionLoading('');
  };

  const loadS3Backups = async () => {
    setS3Loading(true);
    try {
      const token = localStorage.getItem('netcontrol_token');
      const res = await axios.get('/api/backup/s3/list', { headers: { Authorization: 'Bearer ' + token } });
      setS3Backups(res.data.backups || []);
    } catch (e) { setS3Backups([]); }
    setS3Loading(false);
  };

  const handleS3Restore = async (key) => {
    if (!window.confirm('This will REPLACE all data with this S3 backup. Are you sure?')) return;
    setActionLoading('s3restore-' + key);
    try {
      const token = localStorage.getItem('netcontrol_token');
      const res = await axios.post('/api/backup/s3/restore', { key }, { headers: { Authorization: 'Bearer ' + token } });
      const summary = Object.entries(res.data.results).map(([t, v]) => t + ': ' + v.restored).join(', ');
      toast.success('Restored from S3: ' + summary, { duration: 6000 });
    } catch (e) { toast.error(e.response?.data?.error || 'S3 restore failed'); }
    setActionLoading('');
  };

  const handleS3Delete = async (key) => {
    if (!window.confirm('Delete this backup from S3?')) return;
    try {
      const token = localStorage.getItem('netcontrol_token');
      await axios.delete('/api/backup/s3/' + encodeURIComponent(key), { headers: { Authorization: 'Bearer ' + token } });
      toast.success('Backup deleted'); loadS3Backups();
    } catch (e) { toast.error(e.response?.data?.error || 'Delete failed'); }
  };

  React.useEffect(() => { loadS3Backups(); }, []);

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="mt-4">
      <h4 className="mb-3">Backup & Restore</h4>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <button className="btn btn-primary" onClick={handleDownload} disabled={!!actionLoading}>
          {actionLoading === 'download' ? <Loader size={14} className="animate-spin me-1" /> : <Download size={14} className="me-1" />}
          Download Backup
        </button>
        <button className="btn btn-outline-primary" onClick={() => fileInputRef.current?.click()} disabled={!!actionLoading}>
          {actionLoading === 'upload' ? <Loader size={14} className="animate-spin me-1" /> : <Upload size={14} className="me-1" />}
          Restore from File
        </button>
        <input type="file" ref={fileInputRef} accept=".json" style={{ display: 'none' }} onChange={handleUploadRestore} />
        <button className="btn btn-success" onClick={handleS3Upload} disabled={!!actionLoading}>
          {actionLoading === 's3upload' ? <Loader size={14} className="animate-spin me-1" /> : <Upload size={14} className="me-1" />}
          Backup to S3
        </button>
        <button className="btn btn-outline-secondary btn-sm" onClick={loadS3Backups} disabled={s3Loading}>
          <RotateCcw size={14} className={s3Loading ? 'animate-spin' : ''} />
        </button>
      </div>
      {s3Backups.length > 0 && (
        <div>
          <h5>S3 Backups</h5>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead><tr><th>Name</th><th>Size</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {s3Backups.map(b => (
                  <tr key={b.key}>
                    <td className="small">{b.name}</td>
                    <td className="small">{formatSize(b.size)}</td>
                    <td className="small">{new Date(b.lastModified).toLocaleString()}</td>
                    <td>
                      <div className="d-flex gap-1">
                        <button className="btn btn-sm btn-outline-primary" onClick={() => handleS3Restore(b.key)} disabled={actionLoading === 's3restore-' + b.key}>
                          {actionLoading === 's3restore-' + b.key ? <Loader size={12} className="animate-spin" /> : 'Restore'}
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleS3Delete(b.key)}><X size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;