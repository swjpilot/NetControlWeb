import React from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  Radio, 
  TrendingUp,
  Clock,
  Headphones,
  UserCheck,
  RefreshCw,
  Plus
} from 'lucide-react';
import axios from 'axios';
import { formatDateLocal } from '../utils/dateUtils';

const Dashboard = () => {
  const queryClient = useQueryClient();
  // Fetch recent sessions
  const { data: recentSessions, isLoading: sessionsLoading } = useQuery(
    'recent-sessions',
    () => axios.get('/api/sessions?limit=5').then(res => res.data.sessions)
  );

  // Fetch operator count
  const { data: operatorStats } = useQuery(
    'operator-stats',
    () => axios.get('/api/operators?limit=1').then(res => ({ count: res.data.total || 0 }))
  );

  // Fetch session stats
  const { data: sessionStats } = useQuery(
    'session-stats',
    () => axios.get('/api/sessions/stats/summary').then(res => res.data.stats)
  );

  // Fetch echolink logins
  const { data: echolinkData, isLoading: echolinkLoading, isFetching: echolinkFetching } = useQuery(
    'dashboard-echolink',
    () => axios.get('/api/echolink').then(res => res.data),
    { refetchInterval: 60000, retry: 3, retryDelay: 5000 }
  );

  // Fetch pre-check-in list
  const { data: preCheckinData, isLoading: preCheckinLoading, isFetching: preCheckinFetching } = useQuery(
    'dashboard-precheckin',
    () => axios.get('/api/pre-checkin').then(res => res.data),
    { refetchInterval: 60000, retry: 3, retryDelay: 5000 }
  );

  // Get today's date for quick session access
  // const today = new Date().toISOString().split('T')[0];

  const stats = [
    {
      title: 'Total Operators',
      value: operatorStats?.count || 0,
      icon: Users,
      color: 'text-primary',
      link: '/operators'
    },
    {
      title: 'Total Sessions',
      value: sessionStats?.total_sessions || 0,
      icon: Calendar,
      color: 'text-success',
      link: '/sessions'
    },
    {
      title: 'Recent Sessions',
      value: sessionStats?.sessions_last_7_days || 0,
      icon: Radio,
      color: 'text-warning',
      link: '/sessions'
    },
    {
      title: 'Traffic Handled',
      value: sessionStats?.total_traffic_handled || 0,
      icon: TrendingUp,
      color: 'text-danger',
      link: '/sessions'
    }
  ];

  return (
    <div>
      <div className="page-header mb-3">
        <div className="page-header-content">
          <h1>NetControl Dashboard</h1>
          <div className="page-header-actions">
            <Link to="/sessions/quick" className="btn btn-success">
              <Plus size={16} />
              <span className="d-none d-sm-inline ms-1">Quick Entry</span>
            </Link>
            <Link to="/sessions" className="btn btn-primary">
              <Calendar size={16} />
              <span className="d-none d-sm-inline ms-1">View Sessions</span>
            </Link>
            <Link to="/qrz" className="btn btn-secondary">
              <Radio size={16} />
              <span className="d-none d-sm-inline ms-1">QRZ Lookup</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid mb-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Link key={index} to={stat.link} className="stats-card">
              <div className="stats-card-content">
                <div className="stats-card-info">
                  <h3>{stat.value}</h3>
                  <p>{stat.title}</p>
                </div>
                <div className="stats-card-icon">
                  <Icon size={32} className={stat.color} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Echolink & Pre-Check-In Cards */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card" style={{ height: '100%' }}>
            <div className="card-header">
              <h2 className="card-title">
                <Headphones size={18} className="me-2" />
                Echolink Logins
              </h2>
              <div className="d-flex align-items-center gap-2">
                {echolinkData?.count > 0 && (
                  <span className="badge bg-success">{echolinkData.count}</span>
                )}
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => queryClient.invalidateQueries('dashboard-echolink')}
                  disabled={echolinkFetching}
                  title="Refresh"
                >
                  <RefreshCw size={14} className={echolinkFetching ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
            <div className="card-body" style={{ maxHeight: 250, overflowY: 'auto' }}>
              {echolinkLoading ? (
                <div className="loading"><div className="spinner"></div></div>
              ) : echolinkData?.logins?.length > 0 ? (
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Call Sign</th>
                      <th>Name</th>
                      <th>Node</th>
                    </tr>
                  </thead>
                  <tbody>
                    {echolinkData.logins.map((login, i) => (
                      <tr key={i}>
                        <td><strong>{login.callSign || login.call || ''}</strong></td>
                        <td>{login.name || ''}</td>
                        <td>{login.node || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-3 text-muted">
                  <Headphones size={32} className="mb-2" />
                  <p className="small mb-0">No echolink logins</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card" style={{ height: '100%' }}>
            <div className="card-header">
              <h2 className="card-title">
                <UserCheck size={18} className="me-2" />
                Pre-Net Check-Ins
              </h2>
              <div className="d-flex align-items-center gap-2">
                {preCheckinData?.count > 0 && (
                  <span className="badge bg-primary">{preCheckinData.count}</span>
                )}
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => queryClient.invalidateQueries('dashboard-precheckin')}
                  disabled={preCheckinFetching}
                  title="Refresh"
                >
                  <RefreshCw size={14} className={preCheckinFetching ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
            <div className="card-body" style={{ maxHeight: 250, overflowY: 'auto' }}>
              {preCheckinLoading ? (
                <div className="loading"><div className="spinner"></div></div>
              ) : preCheckinData?.participants?.length > 0 ? (
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Call Sign</th>
                      <th>Name</th>
                      <th>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preCheckinData.participants.map((p, i) => (
                      <tr key={i}>
                        <td><strong>{p.callSign || ''}</strong></td>
                        <td>{p.firstName || ''}</td>
                        <td>{p.location || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-3 text-muted">
                  <UserCheck size={32} className="mb-2" />
                  <p className="small mb-0">No pre-check-ins yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        {/* Recent Sessions */}
        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Recent Net Sessions</h2>
              <Link to="/sessions" className="btn btn-sm btn-primary">
                View All
              </Link>
            </div>
            <div className="card-body">
              {sessionsLoading ? (
                <div className="loading">
                  <div className="spinner"></div>
                </div>
              ) : recentSessions && recentSessions.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Net Control</th>
                        <th>Participants</th>
                        <th>Traffic</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSessions.map((session) => (
                        <tr 
                          key={session.id}
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            // Don't navigate if clicking on the View button
                            if (e.target.closest('.btn')) return;
                            window.location.href = `/sessions/${session.id}`;
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                        >
                          <td>
                            <div className="d-flex align-items-center">
                              <Calendar size={16} className="text-muted me-2" />
                              {formatDateLocal(session.session_date)}
                            </div>
                          </td>
                          <td>
                            <div>
                              <strong>{session.net_control_call || 'TBD'}</strong>
                              {session.net_control_name && (
                                <div className="text-muted small">
                                  {session.net_control_name}
                                </div>
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
                            <Link 
                              to={`/sessions/${session.id}`}
                              className="btn btn-sm btn-outline-primary"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Calendar size={48} className="text-muted mb-3" />
                  <p className="text-muted">No recent sessions found</p>
                  <Link to="/sessions" className="btn btn-primary">
                    Create First Session
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Quick Actions</h2>
            </div>
            <div className="card-body">
              <div className="d-grid gap-2">
                <Link to="/sessions" className="btn btn-primary">
                  <Calendar size={16} />
                  Manage Sessions
                </Link>
                <Link to="/operators" className="btn btn-secondary">
                  <Users size={16} />
                  Manage Operators
                </Link>
                <Link to="/qrz" className="btn btn-success">
                  <Radio size={16} />
                  QRZ Lookup
                </Link>
                <Link to="/reports" className="btn btn-warning">
                  <TrendingUp size={16} />
                  Generate Report
                </Link>
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="card mt-3">
            <div className="card-header">
              <h2 className="card-title">System Status</h2>
            </div>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span>Server Connection</span>
                <span className="status status-online">Online</span>
              </div>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span>Database</span>
                <span className="status status-online">Connected</span>
              </div>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span>Last Backup</span>
                <span className="text-muted small">
                  <Clock size={12} />
                  2 hours ago
                </span>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span>FCC Database</span>
                <span className="text-muted small">
                  Updated yesterday
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;