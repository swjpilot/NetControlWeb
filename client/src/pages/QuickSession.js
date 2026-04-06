import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Save, Loader, FileText, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { toDateInputValue, getTodayDate } from '../utils/dateUtils';

const QuickSession = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { getSetting } = useSettings();
  const [selectedNetControlUser, setSelectedNetControlUser] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [announcements, setAnnouncements] = useState(true);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      session_date: getTodayDate(),
      net_type: 'Regular',
      mode: 'FM',
      frequency: '',
      start_time: '',
      power: '',
      total_checkins: '',
      total_traffic: '',
      notes: '',
      net_control_call: '',
      net_control_name: ''
    }
  });

  // Fetch users with callsigns for net control dropdown
  const { data: netControlUsers } = useQuery(
    'net-control-users',
    () => axios.get('/api/auth/net-control-users').then(res => res.data.users)
  );

  // Fill hidden defaults from settings once they load
  useEffect(() => {
    const freq = getSetting('default_net_frequency', '');
    const time = getSetting('default_net_time', '');
    const power = getSetting('default_net_power', '');
    if (freq) setValue('frequency', freq);
    if (time) setValue('start_time', time);
    if (power) setValue('power', power);
  }, [getSetting, setValue]);

  // Auto-select logged-in user as net controller
  useEffect(() => {
    if (netControlUsers && user?.callSign) {
      const match = netControlUsers.find(u =>
        u.callSign?.toUpperCase() === user.callSign.toUpperCase()
      );
      if (match) {
        setSelectedNetControlUser(String(match.id));
        setValue('net_control_call', match.callSign);
        setValue('net_control_name', match.name || match.username);
      } else {
        setValue('net_control_call', user.callSign);
        setValue('net_control_name', user.name || user.username || '');
      }
    }
  }, [netControlUsers, user, setValue]);

  // Create session, then submit net report, then navigate
  const onSubmit = async (data) => {
    setIsSaving(true);
    try {
      // 1. Create the session
      const response = await axios.post('/api/sessions', data);
      const sessionId = response.data.id;
      queryClient.invalidateQueries('sessions');
      toast.success('Session saved successfully');

      // 2. Submit net report for the new session
      try {
        const reportResponse = await axios.post(`/api/sessions/${sessionId}/submit-net-report`, { announcements: announcements ? 'Yes' : 'No' });
        if (reportResponse.data.success) {
          toast.success('Net report submitted successfully');
        }
      } catch (reportError) {
        const msg = reportError.response?.data?.error || 'Net report submission failed';
        toast.error(msg);
      }

      navigate('/sessions');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create session');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNetControlUserChange = (userId) => {
    setSelectedNetControlUser(userId);
    if (userId) {
      const selected = netControlUsers?.find(u => u.id === parseInt(userId));
      if (selected) {
        setValue('net_control_call', selected.callSign);
        setValue('net_control_name', selected.name || selected.username);
      }
    } else {
      setValue('net_control_call', '');
      setValue('net_control_name', '');
    }
  };

  const netTypes = ['Regular', 'Emergency', 'Training', 'Special Event', 'ARES/RACES'];

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>
          <FileText size={24} className="me-2" />
          Quick Session Entry
        </h1>
      </div>

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Hidden fields pre-filled from defaults */}
            <input type="hidden" {...register('frequency')} />
            <input type="hidden" {...register('start_time')} />
            <input type="hidden" {...register('power')} />
            <input type="hidden" {...register('mode')} />

            {/* Date and Net Type */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Session Date *</label>
                <input
                  type="date"
                  className={`form-control ${errors.session_date ? 'error' : ''}`}
                  {...register('session_date', { required: 'Session date is required' })}
                />
                {errors.session_date && (
                  <div className="form-error">{errors.session_date.message}</div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Net Type</label>
                <select className="form-control" {...register('net_type')}>
                  {netTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Net Controller Dropdown */}
            <div className="form-group">
              <label className="form-label">Net Controller</label>
              <select
                className="form-control"
                value={selectedNetControlUser}
                onChange={(e) => handleNetControlUserChange(e.target.value)}
              >
                <option value="">Select from users...</option>
                {netControlUsers?.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.callSign} - {u.name || u.username}
                  </option>
                ))}
              </select>
            </div>

            {/* Call Sign and Name */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Call Sign *</label>
                <input
                  type="text"
                  className={`form-control ${errors.net_control_call ? 'error' : ''}`}
                  placeholder="e.g., W1AW"
                  style={{ textTransform: 'uppercase' }}
                  {...register('net_control_call', {
                    required: 'Call sign is required',
                    pattern: { value: /^[A-Z0-9/]+$/i, message: 'Invalid callsign' }
                  })}
                />
                {errors.net_control_call && (
                  <div className="form-error">{errors.net_control_call.message}</div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Operator name"
                  {...register('net_control_name')}
                />
              </div>
            </div>

            {/* Participants and Traffic */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Number of Participants</label>
                <input
                  type="number"
                  className="form-control"
                  min="0"
                  placeholder="0"
                  {...register('total_checkins')}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Number of Traffic Messages</label>
                <input
                  type="number"
                  className="form-control"
                  min="0"
                  placeholder="0"
                  {...register('total_traffic')}
                />
              </div>
              <div className="form-group">
                <label className="form-label">NC Net Count</label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  placeholder="Auto"
                  {...register('net_count')}
                />
                <div className="form-text">Times this NC has called the net. Auto-calculated if blank.</div>
              </div>
            </div>

            {/* Notes */}
            <div className="form-group">
              <div className="form-check mt-2">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="announcements"
                  checked={announcements}
                  onChange={(e) => setAnnouncements(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="announcements">
                  Announce On Air
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Session Notes</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Notes about the session..."
                {...register('notes')}
              />
            </div>

            {/* Buttons */}
            <div className="d-flex gap-2 mt-3">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
              >
                {isSaving ? (
                  <><Loader size={16} className="animate-spin me-2" />Saving &amp; Submitting...</>
                ) : (
                  <><Send size={16} className="me-2" />Save &amp; Submit Report</>
                )}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/sessions')}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default QuickSession;
