import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Settings, Play, AlertCircle, CheckCircle, Info, Power, PowerOff } from 'lucide-react';
import axios from 'axios';

const FCCScheduleWorking = () => {
  const [settings, setSettings] = useState({
    enabled: false,
    days_of_week: '0',
    time_utc: '06:00',
    data_type: 'ALL',
    timezone: 'UTC'
  });
  const [status, setStatus] = useState({
    enabled: false,
    lastUpdated: null,
    nextRunTime: null,
    ruleStatus: 'DISABLED'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);

  const daysOfWeek = [
    { value: '0', label: 'Sun', fullLabel: 'Sunday' },
    { value: '1', label: 'Mon', fullLabel: 'Monday' },
    { value: '2', label: 'Tue', fullLabel: 'Tuesday' },
    { value: '3', label: 'Wed', fullLabel: 'Wednesday' },
    { value: '4', label: 'Thu', fullLabel: 'Thursday' },
    { value: '5', label: 'Fri', fullLabel: 'Friday' },
    { value: '6', label: 'Sat', fullLabel: 'Saturday' }
  ];

  const dataTypes = [
    { value: 'ALL', label: 'All Records', description: 'Amateur + Entity + History' },
    { value: 'AM', label: 'Amateur Only', description: 'License classes and amateur data' },
    { value: 'EN', label: 'Entity Only', description: 'Names and addresses' }
  ];

  useEffect(() => {
    console.log('FCCScheduleWorking component mounted');
    loadSettings();
    loadStatus();
  }, []);

  const loadSettings = async () => {
    try {
      console.log('Loading settings...');
      const response = await axios.get('/api/fcc/schedule/settings');
      console.log('Settings response:', response.data);

      if (response.status === 200) {
        const data = response.data;
        setSettings({
          enabled: data.settings.enabled === 'true',
          days_of_week: data.settings.days_of_week || '0',
          time_utc: data.settings.time_utc || '06:00',
          data_type: data.settings.data_type || 'ALL',
          timezone: data.settings.timezone || 'UTC'
        });
        setStatus(prev => ({ ...prev, ruleStatus: data.ruleStatus }));
      } else {
        throw new Error('Failed to load settings');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setError(`Failed to load settings: ${error.message}`);
      setMessage('Error loading schedule settings');
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async () => {
    try {
      const response = await axios.get('/api/fcc/schedule/status');
      if (response.status === 200) {
        const data = response.data;
        setStatus(data);
      }
    } catch (error) {
      console.error('Error loading status:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage('');

    try {
      const response = await axios.post('/api/fcc/schedule/settings', settings);
      if (response.status === 200) {
        setMessage('Schedule settings saved successfully!');
        await loadStatus();
      } else {
        throw new Error(response.data?.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage(`Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const testSchedule = async () => {
    setTesting(true);
    setMessage('');

    try {
      const response = await axios.post('/api/fcc/schedule/test', { 
        data_type: settings.data_type 
      });
      if (response.status === 200) {
        const data = response.data;
        setMessage(`Test download initiated! Job ID: ${data.jobId}`);
      } else {
        throw new Error(response.data?.error || 'Failed to test schedule');
      }
    } catch (error) {
      console.error('Error testing schedule:', error);
      setMessage(`Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleDayToggle = (dayValue) => {
    const currentDays = settings.days_of_week.split(',').filter(d => d.trim());
    const dayIndex = currentDays.indexOf(dayValue);

    let newDays;
    if (dayIndex > -1) {
      newDays = currentDays.filter(d => d !== dayValue);
    } else {
      newDays = [...currentDays, dayValue].sort((a, b) => parseInt(a) - parseInt(b));
    }

    setSettings(prev => ({
      ...prev,
      days_of_week: newDays.join(',')
    }));
  };

  const formatNextRunTime = (isoString) => {
    if (!isoString) return 'Not scheduled';
    
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 24) {
      return `${date.toLocaleTimeString()} (in ${diffHours} hours)`;
    } else {
      const diffDays = Math.round(diffHours / 24);
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString()} (in ${diffDays} days)`;
    }
  };

  const getSelectedDaysText = () => {
    if (!settings.days_of_week) return 'None';
    
    const selectedDays = settings.days_of_week.split(',').filter(d => d.trim());
    return selectedDays.map(dayValue => {
      const day = daysOfWeek.find(d => d.value === dayValue);
      return day ? day.fullLabel : dayValue;
    }).join(', ');
  };

  if (loading) {
    return (
      <div className="container-fluid d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted">Loading schedule settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-fluid d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <AlertCircle size={48} className="text-danger mb-3" />
          <h2 className="h4 mb-3">Error Loading Scheduler</h2>
          <p className="text-muted mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="container">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="d-flex align-items-center justify-content-center mb-3">
            <Calendar size={32} className="text-primary me-3" />
            <h1 className="display-5 mb-0">FCC Database Scheduler</h1>
          </div>
          <p className="lead text-muted">
            Automate FCC database updates to keep your amateur radio data current. 
            Configure when and what data to download automatically.
          </p>
        </div>

        {/* Status Card */}
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title d-flex align-items-center mb-0">
              {status.enabled ? (
                <Power size={20} className="text-success me-2" />
              ) : (
                <PowerOff size={20} className="text-muted me-2" />
              )}
              Current Status
            </h2>
          </div>
          <div className="card-body">
            <div className="row g-4">
              <div className="col-md-4 text-center">
                <span className={`badge ${status.enabled ? 'bg-success' : 'bg-secondary'} fs-6 mb-2`}>
                  {status.enabled ? 'Active' : 'Inactive'}
                </span>
                <p className="text-muted small mb-0">Schedule Status</p>
              </div>
              <div className="col-md-4 text-center">
                <p className="h5 mb-1">
                  {status.lastUpdated ? new Date(status.lastUpdated).toLocaleDateString() : 'Never'}
                </p>
                <p className="text-muted small mb-0">Last Updated</p>
              </div>
              <div className="col-md-4 text-center">
                <p className="h5 mb-1">
                  {status.enabled ? formatNextRunTime(status.nextRunTime) : 'Not scheduled'}
                </p>
                <p className="text-muted small mb-0">Next Run</p>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Card */}
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title d-flex align-items-center mb-0">
              <Settings size={20} className="text-primary me-2" />
              Schedule Configuration
            </h2>
          </div>
          <div className="card-body">
            {/* Enable/Disable Toggle */}
            <div className="d-flex align-items-center justify-content-between p-3 bg-light rounded mb-4">
              <div>
                <h3 className="h5 mb-1">Automatic Updates</h3>
                <p className="text-muted small mb-0">Enable scheduled FCC database downloads</p>
              </div>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="enableSchedule"
                  checked={settings.enabled}
                  onChange={(e) => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                />
                <label className="form-check-label" htmlFor="enableSchedule"></label>
              </div>
            </div>

            {settings.enabled && (
              <>
                {/* Days of Week */}
                <div className="mb-4">
                  <label className="form-label fw-semibold">Days of Week</label>
                  <div className="row g-2">
                    {daysOfWeek.map(day => (
                      <div key={day.value} className="col">
                        <button
                          type="button"
                          onClick={() => handleDayToggle(day.value)}
                          className={`btn w-100 ${
                            settings.days_of_week.split(',').includes(day.value)
                              ? 'btn-primary'
                              : 'btn-outline-secondary'
                          }`}
                        >
                          <div className="text-center">
                            <div className="fw-semibold">{day.label}</div>
                          </div>
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="form-text">
                    Selected: {getSelectedDaysText()}
                  </div>
                </div>

                {/* Time and Data Type */}
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">
                      <Clock size={16} className="me-1" />
                      Time (UTC)
                    </label>
                    <input
                      type="time"
                      className="form-control"
                      value={settings.time_utc}
                      onChange={(e) => setSettings(prev => ({ ...prev, time_utc: e.target.value }))}
                    />
                    <div className="form-text">
                      Current UTC: {new Date().toUTCString().split(' ')[4]}
                    </div>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Data Type</label>
                    <select
                      className="form-select"
                      value={settings.data_type}
                      onChange={(e) => setSettings(prev => ({ ...prev, data_type: e.target.value }))}
                    >
                      {dataTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label} - {type.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="row g-3 mb-4">
          <div className="col-sm-6">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="btn btn-primary w-100 d-flex align-items-center justify-content-center"
            >
              <Settings size={20} className="me-2" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
          <div className="col-sm-6">
            <button
              onClick={testSchedule}
              disabled={testing}
              className="btn btn-success w-100 d-flex align-items-center justify-content-center"
            >
              <Play size={20} className="me-2" />
              {testing ? 'Testing...' : 'Test Now'}
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`alert ${
            message.includes('Error') ? 'alert-danger' : 'alert-success'
          } d-flex align-items-center mb-4`}>
            {message.includes('Error') ? (
              <AlertCircle size={20} className="me-2" />
            ) : (
              <CheckCircle size={20} className="me-2" />
            )}
            {message}
          </div>
        )}

        {/* Help Section */}
        <div className="card border-primary">
          <div className="card-header bg-primary bg-opacity-10">
            <h3 className="card-title d-flex align-items-center text-primary mb-0">
              <Info size={20} className="me-2" />
              How It Works
            </h3>
          </div>
          <div className="card-body">
            <div className="row g-4">
              <div className="col-md-6">
                <h4 className="h6 fw-semibold mb-2">Automatic Updates</h4>
                <ul className="list-unstyled small">
                  <li className="mb-1">• Downloads happen in the background using AWS Lambda</li>
                  <li className="mb-1">• Existing records are replaced with fresh FCC data</li>
                  <li className="mb-1">• Progress can be monitored in the FCC Database page</li>
                </ul>
              </div>
              <div className="col-md-6">
                <h4 className="h6 fw-semibold mb-2">Configuration Tips</h4>
                <ul className="list-unstyled small">
                  <li className="mb-1">• Choose off-peak hours to minimize impact</li>
                  <li className="mb-1">• "All Records" provides complete data coverage</li>
                  <li className="mb-1">• Use "Test Now" to verify your setup works</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FCCScheduleWorking;