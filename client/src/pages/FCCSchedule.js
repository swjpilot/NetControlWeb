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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading schedule settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Scheduler</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Calendar className="h-8 w-8 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">FCC Database Scheduler</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Automate FCC database updates to keep your amateur radio data current. 
            Configure when and what data to download automatically.
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              {status.enabled ? (
                <Power className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <PowerOff className="h-5 w-5 text-gray-400 mr-2" />
              )}
              Current Status
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  status.enabled 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {status.enabled ? 'Active' : 'Inactive'}
                </div>
                <p className="text-sm text-gray-500 mt-2">Schedule Status</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900">
                  {status.lastUpdated ? new Date(status.lastUpdated).toLocaleDateString() : 'Never'}
                </p>
                <p className="text-sm text-gray-500 mt-1">Last Updated</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-900">
                  {status.enabled ? formatNextRunTime(status.nextRunTime) : 'Not scheduled'}
                </p>
                <p className="text-sm text-gray-500 mt-1">Next Run</p>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Settings className="h-5 w-5 text-blue-600 mr-2" />
              Schedule Configuration
            </h2>
          </div>
          <div className="p-6 space-y-8">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Automatic Updates</h3>
                <p className="text-sm text-gray-600">Enable scheduled FCC database downloads</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {settings.enabled && (
              <>
                {/* Days of Week */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Days of Week
                  </label>
                  <div className="grid grid-cols-7 gap-2">
                    {daysOfWeek.map(day => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => handleDayToggle(day.value)}
                        className={`px-3 py-3 text-sm font-medium rounded-lg border transition-colors ${
                          settings.days_of_week.split(',').includes(day.value)
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-center">
                          <div className="font-semibold">{day.label}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Selected: {getSelectedDaysText()}
                  </p>
                </div>

                {/* Time and Data Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="h-4 w-4 inline mr-1" />
                      Time (UTC)
                    </label>
                    <input
                      type="time"
                      value={settings.time_utc}
                      onChange={(e) => setSettings(prev => ({ ...prev, time_utc: e.target.value }))}
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Current UTC: {new Date().toUTCString().split(' ')[4]}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data Type
                    </label>
                    <select
                      value={settings.data_type}
                      onChange={(e) => setSettings(prev => ({ ...prev, data_type: e.target.value }))}
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
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
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex-1 flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Settings className="h-5 w-5 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>

          <button
            onClick={testSchedule}
            disabled={testing}
            className="flex-1 flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="h-5 w-5 mr-2" />
            {testing ? 'Testing...' : 'Test Now'}
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`rounded-lg p-4 mb-8 ${
            message.includes('Error') 
              ? 'bg-red-50 text-red-700 border border-red-200' 
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            <div className="flex items-center">
              {message.includes('Error') ? (
                <AlertCircle className="h-5 w-5 mr-2" />
              ) : (
                <CheckCircle className="h-5 w-5 mr-2" />
              )}
              {message}
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
            <Info className="h-5 w-5 mr-2" />
            How It Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-800">
            <div>
              <h4 className="font-semibold mb-2">Automatic Updates</h4>
              <ul className="space-y-1">
                <li>• Downloads happen in the background using AWS Lambda</li>
                <li>• Existing records are replaced with fresh FCC data</li>
                <li>• Progress can be monitored in the FCC Database page</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Configuration Tips</h4>
              <ul className="space-y-1">
                <li>• Choose off-peak hours to minimize impact</li>
                <li>• "All Records" provides complete data coverage</li>
                <li>• Use "Test Now" to verify your setup works</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FCCScheduleWorking;