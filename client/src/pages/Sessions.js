import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Calendar, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Radio, 
  User,
  Filter,
  Eye,
  Play,
  Square,
  Loader
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import toast from 'react-hot-toast';
import ResponsiveTable from '../components/ResponsiveTable';

const Sessions = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedNetControlUser, setSelectedNetControlUser] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    return parseInt(localStorage.getItem('netcontrol_items_per_page')) || 25;
  });
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors }, setValue } = useForm();

  // Fetch all sessions
  const { data: sessionsData, isLoading } = useQuery(
    ['sessions', searchTerm, dateFrom, dateTo, currentPage, itemsPerPage],
    () => axios.get('/api/sessions', {
      params: {
        search: searchTerm || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage
      }
    }).then(res => res.data)
  );

  // Fetch users with callsigns for net control dropdown
  const { data: netControlUsers } = useQuery(
    'net-control-users',
    () => axios.get('/api/auth/net-control-users').then(res => res.data.users)
  );

  const sessions = sessionsData?.sessions || [];
  const totalSessions = sessionsData?.total || 0;
  const totalPages = Math.ceil(totalSessions / itemsPerPage);

  // Add session mutation
  const addSessionMutation = useMutation(
    (sessionData) => axios.post('/api/sessions', sessionData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('sessions');
        toast.success('Session created successfully');
        reset();
        setSelectedNetControlUser('');
        setShowAddForm(false);
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to create session');
      }
    }
  );

  // Update session mutation
  const updateSessionMutation = useMutation(
    ({ sessionId, sessionData }) => axios.put(`/api/sessions/${sessionId}`, sessionData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('sessions');
        toast.success('Session updated successfully');
        setEditingSession(null);
        setSelectedNetControlUser('');
        reset();
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to update session');
      }
    }
  );

  // Delete session mutation
  const deleteSessionMutation = useMutation(
    (sessionId) => axios.delete(`/api/sessions/${sessionId}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('sessions');
        toast.success('Session deleted successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to delete session');
      }
    }
  );

  const onSubmit = (data) => {
    if (editingSession) {
      updateSessionMutation.mutate({
        sessionId: editingSession.id,
        sessionData: data
      });
    } else {
      addSessionMutation.mutate(data);
    }
  };

  const handleEdit = (session) => {
    setEditingSession(session);
    setValue('session_date', session.session_date);
    setValue('start_time', session.start_time || '');
    setValue('end_time', session.end_time || '');
    setValue('net_control_call', session.net_control_call);
    setValue('net_control_name', session.net_control_name || '');
    setValue('frequency', session.frequency || '');
    setValue('mode', session.mode || 'FM');
    setValue('power', session.power || '');
    setValue('antenna', session.antenna || '');
    setValue('weather', session.weather || '');
    setValue('notes', session.notes || '');
    setValue('net_type', session.net_type || 'Regular');
    
    // Reset the net control user dropdown when editing
    setSelectedNetControlUser('');
    
    setShowAddForm(true);
  };

  const handleDelete = (session) => {
    if (window.confirm(`Are you sure you want to delete the session for "${session.session_date}"? This will also delete all participants and traffic records.`)) {
      deleteSessionMutation.mutate(session.id);
    }
  };

  const cancelEdit = () => {
    setEditingSession(null);
    setShowAddForm(false);
    setSelectedNetControlUser('');
    reset();
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
    localStorage.setItem('netcontrol_items_per_page', newItemsPerPage.toString());
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset page when search/filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFrom, dateTo]);

  const handleNetControlUserChange = (userId) => {
    setSelectedNetControlUser(userId);
    if (userId) {
      const selectedUser = netControlUsers?.find(user => user.id === parseInt(userId));
      if (selectedUser) {
        setValue('net_control_call', selectedUser.call_sign);
        setValue('net_control_name', selectedUser.name || selectedUser.username);
      }
    } else {
      setValue('net_control_call', '');
      setValue('net_control_name', '');
    }
  };

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const netTypes = ['Regular', 'Emergency', 'Training', 'Special Event', 'ARES/RACES'];
  const modes = ['FM', 'AM', 'SSB', 'CW', 'Digital', 'DMR', 'D-STAR', 'System Fusion'];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>
          <Calendar size={24} className="me-2" />
          Net Sessions ({totalSessions})
        </h1>
        <div className="d-flex gap-2 align-items-center">
          <div className="d-flex align-items-center gap-2">
            <label className="form-label mb-0 small">Show:</label>
            <select 
              className="form-control form-control-sm"
              style={{ width: 'auto' }}
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(parseInt(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <button 
            className="btn btn-outline-secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} />
            Filters
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus size={16} />
            New Session
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <div className="input-group">
                <span className="input-group-text">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by net control, frequency, or notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            {showFilters && (
              <>
                <div className="form-group">
                  <input
                    type="date"
                    className="form-control"
                    placeholder="From Date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <input
                    type="date"
                    className="form-control"
                    placeholder="To Date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Session Form */}
      {showAddForm && (
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="card-title">
              {editingSession ? 'Edit Session' : 'Create New Session'}
            </h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Session Date *</label>
                  <input
                    type="date"
                    className={`form-control ${errors.session_date ? 'error' : ''}`}
                    defaultValue={getTodayDate()}
                    {...register('session_date', { 
                      required: 'Session date is required'
                    })}
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

              {/* Net Control Selection */}
              <div className="form-group">
                <label className="form-label">Select Net Control User</label>
                <select 
                  className="form-control"
                  value={selectedNetControlUser}
                  onChange={(e) => handleNetControlUserChange(e.target.value)}
                >
                  <option value="">Select from users with callsigns...</option>
                  {netControlUsers?.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.call_sign} - {user.name || user.username}
                    </option>
                  ))}
                </select>
                <div className="form-text">
                  Select a user to auto-fill Net Control Call and Name, or enter manually below
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Net Control Call *</label>
                  <input
                    type="text"
                    className={`form-control ${errors.net_control_call ? 'error' : ''}`}
                    placeholder="e.g., W1AW"
                    style={{ textTransform: 'uppercase' }}
                    {...register('net_control_call', { 
                      required: 'Net control call is required',
                      pattern: {
                        value: /^[A-Z0-9/]+$/i,
                        message: 'Invalid callsign format'
                      }
                    })}
                  />
                  {errors.net_control_call && (
                    <div className="form-error">{errors.net_control_call.message}</div>
                  )}
                </div>
                
                <div className="form-group">
                  <label className="form-label">Net Control Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Operator name"
                    {...register('net_control_name')}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input
                    type="time"
                    className="form-control"
                    {...register('start_time')}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input
                    type="time"
                    className="form-control"
                    {...register('end_time')}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Frequency</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., 146.520 MHz"
                    {...register('frequency')}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Mode</label>
                  <select className="form-control" {...register('mode')}>
                    {modes.map(mode => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Power</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., 50W"
                    {...register('power')}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Antenna</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Yagi, Dipole"
                    {...register('antenna')}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Weather Conditions</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g., Clear, 72°F, Light winds"
                  {...register('weather')}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Session Notes</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="General notes about the session..."
                  {...register('notes')}
                />
              </div>

              <div className="d-flex gap-2">
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={addSessionMutation.isLoading || updateSessionMutation.isLoading}
                >
                  {(addSessionMutation.isLoading || updateSessionMutation.isLoading) ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      {editingSession ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      {editingSession ? 'Update Session' : 'Create Session'}
                    </>
                  )}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            Net Sessions
          </h2>
        </div>
        <div className="card-body">
          {isLoading ? (
            <div className="loading">
              <div className="spinner"></div>
            </div>
          ) : sessions.length > 0 ? (
            <>
              <ResponsiveTable stickyFirstColumn={true} showScrollHint={true}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Net Control</th>
                      <th>Time</th>
                      <th>Frequency</th>
                      <th>Participants</th>
                      <th>Traffic</th>
                      <th>Type</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
                      <tr key={session.id}>
                        <td>
                          <div className="d-flex align-items-center">
                            <Calendar size={16} className="text-primary me-2" />
                            <strong>{new Date(session.session_date).toLocaleDateString()}</strong>
                          </div>
                        </td>
                        <td>
                          <div>
                            <div className="d-flex align-items-center">
                              <Radio size={14} className="text-muted me-1" />
                              <strong>{session.net_control_call}</strong>
                            </div>
                            {session.net_control_name && (
                              <div className="text-muted small">
                                <User size={12} className="me-1" />
                                {session.net_control_name}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div>
                            {session.start_time && (
                              <div className="d-flex align-items-center small">
                                <Play size={12} className="text-success me-1" />
                                {session.start_time}
                              </div>
                            )}
                            {session.end_time && (
                              <div className="d-flex align-items-center small text-muted">
                                <Square size={12} className="text-danger me-1" />
                                {session.end_time}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div>
                            {session.frequency && (
                              <div className="small">{session.frequency}</div>
                            )}
                            {session.mode && session.mode !== 'FM' && (
                              <div className="text-muted small">{session.mode}</div>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-primary">
                            {session.participant_count || 0}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-warning">
                            {session.traffic_count || 0}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-info">{session.net_type || 'Regular'}</span>
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <button 
                              className="btn btn-sm btn-outline-success"
                              onClick={() => window.location.href = `/sessions/${session.id}`}
                              title="View session details"
                            >
                              <Eye size={14} />
                            </button>
                            <button 
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => handleEdit(session)}
                              disabled={updateSessionMutation.isLoading}
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDelete(session)}
                              disabled={deleteSessionMutation.isLoading}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveTable>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <div className="small text-muted">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalSessions)} of {totalSessions} sessions
                  </div>
                  <nav>
                    <ul className="pagination pagination-sm mb-0">
                      <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                        <button 
                          className="page-link"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </button>
                      </li>
                      
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <li key={pageNum} className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                            <button 
                              className="page-link"
                              onClick={() => handlePageChange(pageNum)}
                            >
                              {pageNum}
                            </button>
                          </li>
                        );
                      })}
                      
                      <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                        <button 
                          className="page-link"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <Calendar size={48} className="text-muted mb-3" />
              <p className="text-muted">
                {searchTerm || dateFrom || dateTo ? 'No sessions match your search criteria' : 'No sessions found'}
              </p>
              {!searchTerm && !dateFrom && !dateTo && (
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus size={16} className="me-2" />
                  Create Your First Session
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sessions;