import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Calendar, 
  Plus, 
  Edit, 
  Trash2, 
  Clock,
  Users,
  AlertCircle,
  CheckCircle,
  XCircle,
  Grid,
  List
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import NetCalendar from '../components/NetCalendar';
import { formatDateLocal } from '../utils/dateUtils';

const NetSchedules = () => {
  const { isAdmin } = useAuth();
  const { getSetting } = useSettings();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const [editingException, setEditingException] = useState(null);
  const [exceptionDate, setExceptionDate] = useState('');
  const [selectedDateNets, setSelectedDateNets] = useState([]);
  const [viewMode, setViewMode] = useState('calendar'); // 'list' or 'calendar'
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm({
    defaultValues: {
      name: '',
      description: '',
      frequency: '',
      mode: 'FM',
      net_type: 'Regular',
      start_time: '',
      duration_minutes: 60,
      recurrence_type: '',
      days_of_week: [],
      start_date: '',
      end_date: '',
      active: true,
      monthly_type: 'day_of_month',
      monthly_ordinal: '1',
      monthly_weekday: '0'
    }
  });
  const recurrenceType = watch('recurrence_type');
  const monthlyType = watch('monthly_type');

  // Fetch all schedules
  const { data: schedulesData, isLoading } = useQuery(
    'net-schedules',
    () => axios.get('/api/schedules').then(res => res.data)
  );

  // Fetch users for assignment dropdown
  const { data: usersData } = useQuery(
    'net-control-users',
    () => axios.get('/api/auth/net-control-users').then(res => res.data)
  );

  // Fetch upcoming nets calendar using configurable range
  const calendarDaysPast = parseInt(getSetting('calendar_days_past', '90')) || 90;
  const calendarDaysFuture = parseInt(getSetting('calendar_days_future', '90')) || 90;

  const { data: upcomingData } = useQuery(
    ['upcoming-nets', calendarDaysPast, calendarDaysFuture],
    () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - calendarDaysPast);
      const start_date = pastDate.toISOString().split('T')[0];
      return axios.get('/api/schedules/calendar/upcoming', { params: { days: calendarDaysFuture, start_date } }).then(res => res.data);
    }
  );

  const schedules = schedulesData?.schedules || [];
  const users = usersData?.users || [];
  const upcomingNets = upcomingData?.upcoming_nets || [];

  // Create schedule mutation
  const createScheduleMutation = useMutation(
    (scheduleData) => axios.post('/api/schedules', scheduleData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('net-schedules');
        queryClient.invalidateQueries('upcoming-nets');
        toast.success('Schedule created successfully');
        reset();
        setShowAddForm(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to create schedule');
      }
    }
  );

  // Update schedule mutation
  const updateScheduleMutation = useMutation(
    ({ id, data }) => axios.put(`/api/schedules/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('net-schedules');
        queryClient.invalidateQueries('upcoming-nets');
        toast.success('Schedule updated successfully');
        setEditingSchedule(null);
        reset();
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to update schedule');
      }
    }
  );

  // Delete schedule mutation
  const deleteScheduleMutation = useMutation(
    (id) => axios.delete(`/api/schedules/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('net-schedules');
        queryClient.invalidateQueries('upcoming-nets');
        toast.success('Schedule deleted successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to delete schedule');
      }
    }
  );

  // Add assignment mutation
  const addAssignmentMutation = useMutation(
    ({ scheduleId, assignment }) => axios.post(`/api/schedules/${scheduleId}/assignments`, assignment),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('net-schedules');
        queryClient.invalidateQueries('upcoming-nets');
        toast.success('Operator assigned successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to add assignment');
      }
    }
  );

  // Remove assignment mutation
  const removeAssignmentMutation = useMutation(
    ({ scheduleId, assignmentId }) => axios.delete(`/api/schedules/${scheduleId}/assignments/${assignmentId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('net-schedules');
        queryClient.invalidateQueries('upcoming-nets');
        toast.success('Assignment removed successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to remove assignment');
      }
    }
  );

  // Add exception mutation
  const addExceptionMutation = useMutation(
    ({ scheduleId, exception }) => axios.post(`/api/schedules/${scheduleId}/exceptions`, exception),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('net-schedules');
        queryClient.invalidateQueries('upcoming-nets');
        toast.success('Exception added successfully');
        setShowExceptionForm(false);
        setExceptionDate('');
        setEditingException(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to add exception');
      }
    }
  );

  // Update exception mutation
  const updateExceptionMutation = useMutation(
    ({ scheduleId, exceptionId, exception }) => axios.put(`/api/schedules/${scheduleId}/exceptions/${exceptionId}`, exception),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('net-schedules');
        queryClient.invalidateQueries('upcoming-nets');
        toast.success('Exception updated successfully');
        setShowExceptionForm(false);
        setExceptionDate('');
        setEditingException(null);
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to update exception');
      }
    }
  );

  // Remove exception mutation
  const removeExceptionMutation = useMutation(
    ({ scheduleId, exceptionId }) => axios.delete(`/api/schedules/${scheduleId}/exceptions/${exceptionId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('net-schedules');
        queryClient.invalidateQueries('upcoming-nets');
        toast.success('Exception removed successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to remove exception');
      }
    }
  );

  const onSubmit = (data) => {
    // Create a clean copy of the data
    const cleanData = {};
    
    // Process each field
    Object.keys(data).forEach(key => {
      const value = data[key];
      
      // Handle arrays (like days_of_week)
      if (Array.isArray(value)) {
        cleanData[key] = value.length > 0 ? value.join(',') : null;
      }
      // Handle empty strings
      else if (value === '' || value === undefined || value === null) {
        cleanData[key] = null;
      }
      // Handle strings that need trimming
      else if (typeof value === 'string') {
        const trimmed = value.trim();
        cleanData[key] = trimmed !== '' ? trimmed : null;
      }
      // Keep other values as-is
      else {
        cleanData[key] = value;
      }
    });
    
    // Ensure required fields are present
    if (!cleanData.name || !cleanData.start_time || !cleanData.recurrence_type || !cleanData.start_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    // Validate days_of_week for weekly/biweekly
    if ((cleanData.recurrence_type === 'weekly' || cleanData.recurrence_type === 'biweekly') && !cleanData.days_of_week) {
      toast.error('Please select at least one day of the week');
      return;
    }
    
    console.log('Submitting clean data:', cleanData);
    
    // Handle monthly ordinal fields
    if (cleanData.recurrence_type === 'monthly' && cleanData.monthly_type === 'ordinal_weekday') {
      cleanData.monthly_ordinal = parseInt(cleanData.monthly_ordinal) || 1;
      cleanData.monthly_weekday = parseInt(cleanData.monthly_weekday) || 0;
    } else {
      cleanData.monthly_ordinal = null;
      cleanData.monthly_weekday = null;
    }
    // Remove the UI-only field
    delete cleanData.monthly_type;
    
    if (editingSchedule) {
      updateScheduleMutation.mutate({ id: editingSchedule.id, data: cleanData });
    } else {
      createScheduleMutation.mutate(cleanData);
    }
  };

  const handleEdit = (schedule) => {
    setEditingSchedule(schedule);
    Object.keys(schedule).forEach(key => {
      // Convert days_of_week from comma-separated string to array
      if (key === 'days_of_week' && schedule[key]) {
        const daysArray = schedule[key].split(',').map(d => parseInt(d.trim()));
        setValue(key, daysArray);
      } else {
        setValue(key, schedule[key]);
      }
    });
    // Set monthly_type based on whether ordinal fields are set
    if (schedule.recurrence_type === 'monthly' && schedule.monthly_ordinal) {
      setValue('monthly_type', 'ordinal_weekday');
      setValue('monthly_ordinal', schedule.monthly_ordinal);
      setValue('monthly_weekday', schedule.monthly_weekday);
    } else {
      setValue('monthly_type', 'day_of_month');
    }
    setShowAddForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this schedule? This will remove all assignments and exceptions.')) {
      deleteScheduleMutation.mutate(id);
    }
  };

  const handleAddAssignment = (scheduleId, userId) => {
    const user = users.find(u => u.id === parseInt(userId));
    console.log('handleAddAssignment - user lookup:', { userId, user, allUsers: users });
    if (user) {
      const assignmentData = {
        user_id: user.id,
        call_sign: user.callSign || user.call_sign, // API returns callSign (camelCase)
        name: user.name
      };
      console.log('handleAddAssignment - sending:', assignmentData);
      addAssignmentMutation.mutate({
        scheduleId,
        assignment: assignmentData
      });
    } else {
      console.error('handleAddAssignment - user not found:', userId);
      toast.error('User not found');
    }
  };

  const handleAddException = (scheduleId, exceptionData) => {
    if (editingException) {
      // Update existing exception
      updateExceptionMutation.mutate({
        scheduleId,
        exceptionId: editingException.id,
        exception: exceptionData
      });
    } else {
      // Add new exception
      addExceptionMutation.mutate({
        scheduleId,
        exception: exceptionData
      });
    }
  };

  const handleCalendarDateClick = (dateStr, nets) => {
    if (nets.length === 1) {
      // Single net on this date - open exception form directly
      const schedule = schedules.find(s => s.id === nets[0].schedule_id);
      if (schedule) {
        setSelectedSchedule(schedule);
        setExceptionDate(dateStr);
        setShowExceptionForm(true);
      }
    } else if (nets.length > 1) {
      // Multiple nets - show selection modal
      setSelectedDateNets(nets);
      setExceptionDate(dateStr);
    }
  };

  const getDaysOfWeekString = (daysString) => {
    if (!daysString) return 'N/A';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = daysString.split(',').map(d => dayNames[parseInt(d.trim())]);
    return days.join(', ');
  };

  // Format date string without timezone conversion
  const formatDateString = (dateStr) => {
    return formatDateLocal(dateStr);
  };

  const getRecurrenceDescription = (schedule) => {
    const { recurrence_type, days_of_week, monthly_ordinal, monthly_weekday } = schedule;
    if (recurrence_type === 'daily') return 'Daily';
    if (recurrence_type === 'weekly') return `Weekly on ${getDaysOfWeekString(days_of_week)}`;
    if (recurrence_type === 'biweekly') return `Every other week on ${getDaysOfWeekString(days_of_week)}`;
    if (recurrence_type === 'monthly') {
      if (monthly_ordinal && monthly_weekday !== null && monthly_weekday !== undefined) {
        const ordinalNames = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: 'Last' };
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `Monthly on the ${ordinalNames[monthly_ordinal]} ${dayNames[monthly_weekday]}`;
      }
      return 'Monthly (same day)';
    }
    return recurrence_type;
  };

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="row mb-4">
        <div className="col">
          <h2 className="mb-0">
            <Calendar className="me-2" size={32} />
            Net Schedules
          </h2>
          <p className="text-muted">Manage recurring net schedules and operator assignments</p>
        </div>
        <div className="col-auto d-flex gap-2">
          <div className="btn-group" role="group">
            <button
              className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setViewMode('list')}
            >
              <List size={16} className="me-1" />
              List
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'calendar' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setViewMode('calendar')}
            >
              <Grid size={16} className="me-1" />
              Calendar
            </button>
          </div>
          {isAdmin() && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingSchedule(null);
                reset();
                setShowAddForm(!showAddForm);
              }}
            >
              <Plus size={20} className="me-2" />
              {showAddForm ? 'Cancel' : 'New Schedule'}
            </button>
          )}
        </div>
      </div>

      {showAddForm && isAdmin() && (
        <div className="card mb-4">
          <div className="card-body">
            <h5 className="card-title">{editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}</h5>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Schedule Name *</label>
                  <input
                    type="text"
                    className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                    {...register('name', { required: 'Name is required' })}
                  />
                  {errors.name && <div className="invalid-feedback">{errors.name.message}</div>}
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label">Net Type</label>
                  <select className="form-select" {...register('net_type')}>
                    <option value="Regular">Regular</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Training">Training</option>
                    <option value="Special Event">Special Event</option>
                  </select>
                </div>

                <div className="col-md-12 mb-3">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    {...register('description')}
                  />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label">Frequency</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., 146.520 MHz"
                    {...register('frequency')}
                  />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label">Mode</label>
                  <select className="form-select" {...register('mode')}>
                    <option value="FM">FM</option>
                    <option value="AM">AM</option>
                    <option value="SSB">SSB</option>
                    <option value="CW">CW</option>
                    <option value="Digital">Digital</option>
                  </select>
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label">Duration (minutes)</label>
                  <input
                    type="number"
                    className="form-control"
                    defaultValue="60"
                    {...register('duration_minutes')}
                  />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label">Start Time *</label>
                  <input
                    type="time"
                    className={`form-control ${errors.start_time ? 'is-invalid' : ''}`}
                    {...register('start_time', { required: 'Start time is required' })}
                  />
                  {errors.start_time && <div className="invalid-feedback">{errors.start_time.message}</div>}
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label">Recurrence Type *</label>
                  <select
                    className={`form-select ${errors.recurrence_type ? 'is-invalid' : ''}`}
                    {...register('recurrence_type', { required: 'Recurrence type is required' })}
                  >
                    <option value="">Select...</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every Other Week</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  {errors.recurrence_type && <div className="invalid-feedback">{errors.recurrence_type.message}</div>}
                </div>

                {(recurrenceType === 'weekly' || recurrenceType === 'biweekly') && (
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Days of Week *</label>
                    <div className="d-flex flex-wrap gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                        <div key={index} className="form-check">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`day-${index}`}
                            value={index}
                            {...register('days_of_week')}
                          />
                          <label className="form-check-label" htmlFor={`day-${index}`}>
                            {day}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {recurrenceType === 'monthly' && (
                  <div className="col-md-8 mb-3">
                    <label className="form-label">Monthly Schedule Type</label>
                    <div className="d-flex gap-3 mb-2">
                      <div className="form-check">
                        <input
                          type="radio"
                          className="form-check-input"
                          id="monthly-day"
                          value="day_of_month"
                          {...register('monthly_type')}
                          defaultChecked
                        />
                        <label className="form-check-label" htmlFor="monthly-day">
                          Same day of month (from start date)
                        </label>
                      </div>
                      <div className="form-check">
                        <input
                          type="radio"
                          className="form-check-input"
                          id="monthly-ordinal"
                          value="ordinal_weekday"
                          {...register('monthly_type')}
                        />
                        <label className="form-check-label" htmlFor="monthly-ordinal">
                          Specific weekday of month
                        </label>
                      </div>
                    </div>
                    {monthlyType === 'ordinal_weekday' && (
                      <div className="d-flex gap-2 align-items-center">
                        <select className="form-select" style={{ width: 'auto' }} {...register('monthly_ordinal')}>
                          <option value="1">1st</option>
                          <option value="2">2nd</option>
                          <option value="3">3rd</option>
                          <option value="4">4th</option>
                          <option value="5">Last</option>
                        </select>
                        <select className="form-select" style={{ width: 'auto' }} {...register('monthly_weekday')}>
                          <option value="0">Sunday</option>
                          <option value="1">Monday</option>
                          <option value="2">Tuesday</option>
                          <option value="3">Wednesday</option>
                          <option value="4">Thursday</option>
                          <option value="5">Friday</option>
                          <option value="6">Saturday</option>
                        </select>
                        <span className="text-muted">of each month</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="col-md-4 mb-3">
                  <label className="form-label">Start Date *</label>
                  <input
                    type="date"
                    className={`form-control ${errors.start_date ? 'is-invalid' : ''}`}
                    {...register('start_date', { required: 'Start date is required' })}
                  />
                  {errors.start_date && <div className="invalid-feedback">{errors.start_date.message}</div>}
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label">End Date (optional)</label>
                  <input
                    type="date"
                    className="form-control"
                    {...register('end_date')}
                  />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label">Status</label>
                  <select className="form-select" {...register('active')}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary">
                  {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingSchedule(null);
                    reset();
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewMode === 'calendar' ? (
        /* Calendar View */
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <NetCalendar 
                  upcomingNets={upcomingNets} 
                  onDateClick={handleCalendarDateClick}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* List View */
        <div className="row">
        <div className="col-lg-8">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Configured Schedules</h5>
            </div>
            <div className="card-body">
              {schedules.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <Calendar size={48} className="mb-3 opacity-50" />
                  <p>No schedules configured yet. Create your first schedule to get started.</p>
                </div>
              ) : (
                <div className="list-group">
                  {schedules.map(schedule => (
                    <div key={schedule.id} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center gap-2 mb-2">
                            <h6 className="mb-0">{schedule.name}</h6>
                            {schedule.active ? (
                              <span className="badge bg-success">Active</span>
                            ) : (
                              <span className="badge bg-secondary">Inactive</span>
                            )}
                          </div>
                          <div className="text-muted small mb-2">
                            <Clock size={14} className="me-1" />
                            {schedule.start_time} • {schedule.duration_minutes} min • {getRecurrenceDescription(schedule)}
                          </div>
                          {schedule.frequency && (
                            <div className="text-muted small mb-2">
                              📻 {schedule.frequency} ({schedule.mode})
                            </div>
                          )}
                          {schedule.description && (
                            <div className="text-muted small mb-2">{schedule.description}</div>
                          )}
                          
                          {schedule.assignments && schedule.assignments.length > 0 && (
                            <div className="mt-2">
                              <div className="small fw-bold mb-1">
                                <Users size={14} className="me-1" />
                                Assigned Operators:
                              </div>
                              <div className="d-flex flex-wrap gap-1">
                                {schedule.assignments.map((assignment, idx) => (
                                  <span key={assignment.id} className="badge bg-info">
                                    #{idx + 1} <span style={{ textTransform: 'uppercase' }}>{assignment.call_sign}</span> {assignment.name ? assignment.name.split(' ')[0] : ''}
                                    {isAdmin() && (
                                      <button
                                        className="btn-close btn-close-white ms-2"
                                        style={{ fontSize: '0.6rem' }}
                                        onClick={() => removeAssignmentMutation.mutate({
                                          scheduleId: schedule.id,
                                          assignmentId: assignment.id
                                        })}
                                      />
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {schedule.exceptions && schedule.exceptions.length > 0 && (
                            <div className="mt-2">
                              <div className="small fw-bold mb-1">
                                <AlertCircle size={14} className="me-1" />
                                Exceptions: {schedule.exceptions.length}
                              </div>
                            </div>
                          )}

                          <div className="mt-2">
                            {isAdmin() && (
                              <select
                                className="form-select form-select-sm"
                                style={{ minWidth: '200px', maxWidth: '100%' }}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleAddAssignment(schedule.id, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                              >
                                <option value="">+ Add Operator</option>
                                {users.filter(u => !schedule.assignments?.some(a => a.user_id === u.id)).map(user => (
                                  <option key={user.id} value={user.id}>
                                    {user.callSign || user.call_sign} - {user.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>

                        <div className="d-flex gap-2">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowExceptionForm(false);
                              setEditingException(null);
                              setExceptionDate('');
                              setSelectedSchedule(schedule);
                            }}
                            title="Manage Exceptions"
                          >
                            <Calendar size={16} />
                          </button>
                          {isAdmin() && (
                            <>
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => handleEdit(schedule)}
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(schedule.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Upcoming Nets (Next {calendarDaysFuture} Days)</h5>
            </div>
            <div className="card-body" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {upcomingNets.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <p className="small">No upcoming nets scheduled</p>
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {upcomingNets.slice(0, 30).map((net, idx) => {
                    const schedule = schedules.find(s => s.id === net.schedule_id);
                    return (
                      <div 
                        key={idx} 
                        className="list-group-item px-0"
                        style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                        onClick={() => {
                          if (schedule) {
                            setSelectedSchedule(schedule);
                            
                            // If this net has an exception, edit it; otherwise create new
                            if (net.has_exception && net.exception_id) {
                              // Find the exception in the schedule's exceptions
                              const exception = schedule.exceptions?.find(e => e.id === net.exception_id);
                              if (exception) {
                                console.log('Editing existing exception from upcoming net:', exception);
                                setEditingException(exception);
                              } else {
                                setEditingException(null);
                              }
                            } else {
                              setEditingException(null);
                            }
                            
                            setExceptionDate(net.date);
                            setShowExceptionForm(true);
                          }
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <div className="fw-bold small">{net.schedule_name}</div>
                            <div className="text-muted small">
                              {formatDateString(net.date)} at {net.start_time}
                            </div>
                            {net.assigned_operator && (
                              <div className="small text-primary">
                                NC: <span style={{ textTransform: 'uppercase' }}>{net.assigned_operator.call_sign}</span> {net.assigned_operator.name ? net.assigned_operator.name.split(' ')[0] : ''}
                              </div>
                            )}
                            {net.has_exception && (
                              <div className="small mt-1">
                                {net.exception_type === 'cancelled' && (
                                  <span className="badge bg-danger">Cancelled</span>
                                )}
                                {net.exception_type === 'reassigned' && (
                                  <span className="badge bg-warning">Reassigned</span>
                                )}
                                {net.exception_type === 'time_change' && (
                                  <span className="badge bg-info">Time Changed</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-muted ms-2" style={{ fontSize: '0.65rem', whiteSpace: 'nowrap', alignSelf: 'center' }}>
                            ✏️
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {selectedSchedule && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Manage Exceptions - {selectedSchedule.name}</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setSelectedSchedule(null);
                    setShowExceptionForm(false);
                    setExceptionDate('');
                    setEditingException(null);
                  }}
                />
              </div>
              <div className="modal-body">
                {!showExceptionForm ? (
                  <>
                    <button
                      className="btn btn-primary btn-sm mb-3"
                      onClick={() => {
                        setEditingException(null);
                        setShowExceptionForm(true);
                      }}
                    >
                      <Plus size={16} className="me-1" />
                      Add Exception
                    </button>

                    {selectedSchedule.exceptions && selectedSchedule.exceptions.length > 0 ? (
                      <div className="list-group">
                        {selectedSchedule.exceptions.map(exception => (
                          <div key={exception.id} className="list-group-item">
                            <div className="d-flex justify-content-between align-items-start">
                              <div>
                                <div className="fw-bold">
                                  {formatDateString(exception.exception_date)}
                                </div>
                                <div className="small text-muted">
                                  Type: {exception.exception_type}
                                </div>
                                {exception.assigned_call_sign && (
                                  <div className="small">
                                    Assigned to: <span style={{ textTransform: 'uppercase' }}>{exception.assigned_call_sign}</span>
                                  </div>
                                )}
                                {exception.reason && (
                                  <div className="small text-muted">
                                    Reason: {exception.reason}
                                  </div>
                                )}
                              </div>
                              <div className="d-flex gap-1">
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => {
                                    console.log('Edit exception clicked:', exception);
                                    setEditingException(exception);
                                    setShowExceptionForm(true);
                                  }}
                                  title="Edit exception"
                                >
                                  <Edit size={14} />
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => removeExceptionMutation.mutate({
                                    scheduleId: selectedSchedule.id,
                                    exceptionId: exception.id
                                  })}
                                  title="Delete exception"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted">
                        <p>No exceptions configured for this schedule</p>
                      </div>
                    )}
                  </>
                ) : (
                  <ExceptionForm
                    key={editingException?.id || 'new'}
                    scheduleId={selectedSchedule.id}
                    users={users}
                    initialDate={exceptionDate}
                    editingException={editingException}
                    onSubmit={(data) => handleAddException(selectedSchedule.id, data)}
                    onDelete={editingException ? () => {
                      removeExceptionMutation.mutate({
                        scheduleId: selectedSchedule.id,
                        exceptionId: editingException.id
                      });
                    } : null}
                    onCancel={() => {
                      setShowExceptionForm(false);
                      setExceptionDate('');
                      setEditingException(null);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for selecting which net to add exception to (when multiple nets on same date) */}
      {selectedDateNets.length > 0 && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Select Net for Exception</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setSelectedDateNets([]);
                    setExceptionDate('');
                  }}
                />
              </div>
              <div className="modal-body">
                <p className="text-muted">Multiple nets scheduled on {formatDateString(exceptionDate)}. Select which one to modify:</p>
                <div className="list-group">
                  {selectedDateNets.map((net, idx) => {
                    const schedule = schedules.find(s => s.id === net.schedule_id);
                    return (
                      <button
                        key={idx}
                        className="list-group-item list-group-item-action"
                        onClick={() => {
                          if (schedule) {
                            setSelectedSchedule(schedule);
                            setSelectedDateNets([]);
                            setShowExceptionForm(true);
                          }
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-bold">{net.schedule_name}</div>
                            <div className="small text-muted">
                              {net.start_time} • {net.duration_minutes} min
                            </div>
                            {net.assigned_operator && (
                              <div className="small text-primary">
                                Operator: <span style={{ textTransform: 'uppercase' }}>{net.assigned_operator.call_sign}</span> {net.assigned_operator.name ? net.assigned_operator.name.split(' ')[0] : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ExceptionForm = ({ scheduleId, users, initialDate, editingException, onSubmit, onCancel, onDelete }) => {
  // Format date for input[type="date"] which requires YYYY-MM-DD
  const getFormattedDate = (dateStr) => {
    if (!dateStr) return initialDate || '';
    try {
      return new Date(dateStr).toISOString().split('T')[0];
    } catch {
      return initialDate || '';
    }
  };

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      exception_date: editingException ? getFormattedDate(editingException.exception_date) : (initialDate || ''),
      exception_type: editingException?.exception_type || '',
      assigned_user_id: editingException?.assigned_user_id || '',
      new_start_time: editingException?.new_start_time || '',
      new_duration_minutes: editingException?.new_duration_minutes || '',
      reason: editingException?.reason || ''
    }
  });
  const exceptionType = watch('exception_type');

  // Log for debugging
  React.useEffect(() => {
    console.log('ExceptionForm mounted/updated');
    console.log('  editingException:', editingException);
    console.log('  initialDate:', initialDate);
    console.log('  Form will use defaultValues:', {
      exception_date: editingException ? getFormattedDate(editingException.exception_date) : (initialDate || ''),
      exception_type: editingException?.exception_type || '',
      assigned_user_id: editingException?.assigned_user_id || '',
      new_start_time: editingException?.new_start_time || '',
      new_duration_minutes: editingException?.new_duration_minutes || '',
      reason: editingException?.reason || ''
    });
  }, [editingException]);

  const onFormSubmit = (data) => {
    // Create a clean copy of the data
    const cleanData = {};
    
    // Process each field
    Object.keys(data).forEach(key => {
      const value = data[key];
      
      // Handle empty strings and undefined
      if (value === '' || value === undefined || value === null) {
        cleanData[key] = null;
      }
      // Handle strings that need trimming
      else if (typeof value === 'string') {
        const trimmed = value.trim();
        cleanData[key] = trimmed !== '' ? trimmed : null;
      }
      // Keep other values as-is
      else {
        cleanData[key] = value;
      }
    });

    // Find selected user details if reassigned
    if (cleanData.exception_type === 'reassigned' && cleanData.assigned_user_id) {
      const user = users.find(u => u.id === parseInt(cleanData.assigned_user_id));
      if (user) {
        cleanData.assigned_call_sign = user.callSign || user.call_sign; // API returns callSign (camelCase)
        cleanData.assigned_name = user.name;
      }
    }

    console.log('ExceptionForm - submitting clean data:', cleanData);
    onSubmit(cleanData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)}>
      <h5 className="mb-3">{editingException ? 'Edit Exception' : 'Add New Exception'}</h5>
      
      <div className="mb-3">
        <label className="form-label">Exception Date *</label>
        <input
          type="date"
          className={`form-control ${errors.exception_date ? 'is-invalid' : ''}`}
          {...register('exception_date', { required: 'Date is required' })}
        />
        {errors.exception_date && <div className="invalid-feedback">{errors.exception_date.message}</div>}
      </div>

      <div className="mb-3">
        <label className="form-label">Exception Type *</label>
        <select
          className={`form-select ${errors.exception_type ? 'is-invalid' : ''}`}
          {...register('exception_type', { required: 'Type is required' })}
        >
          <option value="">Select...</option>
          <option value="cancelled">Cancelled</option>
          <option value="reassigned">Reassigned to Different Operator</option>
          <option value="time_change">Time Change</option>
        </select>
        {errors.exception_type && <div className="invalid-feedback">{errors.exception_type.message}</div>}
      </div>

      {exceptionType === 'reassigned' && (
        <div className="mb-3">
          <label className="form-label">Assign To *</label>
          <select
            className={`form-select ${errors.assigned_user_id ? 'is-invalid' : ''}`}
            {...register('assigned_user_id', { required: 'Operator is required for reassignment' })}
          >
            <option value="">Select operator...</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.callSign || user.call_sign} - {user.name}
              </option>
            ))}
          </select>
          {errors.assigned_user_id && <div className="invalid-feedback">{errors.assigned_user_id.message}</div>}
        </div>
      )}

      {exceptionType === 'time_change' && (
        <>
          <div className="mb-3">
            <label className="form-label">New Start Time</label>
            <input
              type="time"
              className="form-control"
              {...register('new_start_time')}
            />
          </div>
          <div className="mb-3">
            <label className="form-label">New Duration (minutes)</label>
            <input
              type="number"
              className="form-control"
              {...register('new_duration_minutes')}
            />
          </div>
        </>
      )}

      <div className="mb-3">
        <label className="form-label">Reason</label>
        <textarea
          className="form-control"
          rows="2"
          {...register('reason')}
        />
      </div>

      <div className="d-flex gap-2 justify-content-between">
        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-primary">
            {editingException ? 'Update Exception' : 'Add Exception'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
        {editingException && onDelete && (
          <button 
            type="button" 
            className="btn btn-danger" 
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this exception?')) {
                onDelete();
              }
            }}
          >
            <Trash2 size={16} className="me-1" />
            Delete
          </button>
        )}
      </div>
    </form>
  );
};

export default NetSchedules;
