import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { 
  FileText, 
  Calendar, 
  Users, 
  Radio, 
  BarChart3,
  Download,
  Filter,
  Printer,
  TrendingUp,
  MapPin,
  Clock,
  MessageSquare,
  Map
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const Reports = () => {
  const [activeReport, setActiveReport] = useState('session-summary');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end: new Date().toISOString().split('T')[0] // today
  });

  // Fetch reports data
  const { data: reportsData, isLoading } = useQuery(
    ['reports', activeReport, dateRange],
    () => axios.get(`/api/reports/${activeReport}`, {
      params: {
        start_date: dateRange.start,
        end_date: dateRange.end
      }
    }).then(res => res.data),
    {
      enabled: !!activeReport
    }
  );

  const reportTypes = [
    {
      id: 'session-summary',
      name: 'Session Summary',
      icon: Calendar,
      description: 'Overview of all net sessions'
    },
    {
      id: 'participant-stats',
      name: 'Participant Statistics',
      icon: Users,
      description: 'Participant activity and trends'
    },
    {
      id: 'operator-activity',
      name: 'Operator Activity',
      icon: Radio,
      description: 'Individual operator participation'
    },
    {
      id: 'geographic-distribution',
      name: 'Geographic Distribution',
      icon: MapPin,
      description: 'Participant locations and coverage'
    },
    {
      id: 'traffic-report',
      name: 'Traffic Report',
      icon: MessageSquare,
      description: 'Message traffic analysis'
    },
    {
      id: 'net-control-report',
      name: 'Net Control Report',
      icon: BarChart3,
      description: 'Net control operator statistics'
    }
  ];

  const handleExport = async (format) => {
    try {
      const response = await fetch(`/api/reports/${activeReport}/export?format=${format}&start_date=${dateRange.start}&end_date=${dateRange.end}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }
      
      // Get filename from response headers or create one
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `${activeReport}_${dateRange.start}_to_${dateRange.end}.${format}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`${format.toUpperCase()} report downloaded successfully!`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error.message || `Failed to export ${format.toUpperCase()} report`);
    }
  };

  const handlePrint = () => {
    window.print();
    toast.success('Opening print dialog...');
  };

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading reports...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>
            <FileText size={24} className="me-2" />
            Reports
          </h1>
          <p className="text-muted">Generate and view net control reports</p>
        </div>
        
        <div className="d-flex gap-2">
          <button 
            className="btn btn-outline-primary"
            onClick={handlePrint}
          >
            <Printer size={16} className="me-2" />
            Print
          </button>
          <div className="dropdown">
            <button 
              className="btn btn-primary dropdown-toggle" 
              type="button" 
              data-bs-toggle="dropdown"
            >
              <Download size={16} className="me-2" />
              Export
            </button>
            <ul className="dropdown-menu">
              <li>
                <button 
                  className="dropdown-item" 
                  onClick={() => handleExport('pdf')}
                >
                  Export as PDF
                </button>
              </li>
              <li>
                <button 
                  className="dropdown-item" 
                  onClick={() => handleExport('csv')}
                >
                  Export as CSV
                </button>
              </li>
              <li>
                <button 
                  className="dropdown-item" 
                  onClick={() => handleExport('xlsx')}
                >
                  Export as Excel
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="row">
        {/* Report Type Selector */}
        <div className="col-md-3">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Report Types</h3>
            </div>
            <div className="card-body p-0">
              <div className="list-group list-group-flush">
                {reportTypes.map(report => {
                  const IconComponent = report.icon;
                  return (
                    <button
                      key={report.id}
                      className={`list-group-item list-group-item-action ${
                        activeReport === report.id ? 'active' : ''
                      }`}
                      onClick={() => setActiveReport(report.id)}
                    >
                      <div className="d-flex align-items-center">
                        <IconComponent size={16} className="me-2" />
                        <div>
                          <div className="fw-bold">{report.name}</div>
                          <div className="small text-muted">{report.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="card mt-3">
            <div className="card-header">
              <h4 className="card-title">
                <Filter size={16} className="me-2" />
                Date Range
              </h4>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
              <div className="d-flex gap-2 mt-3">
                <button 
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setDateRange({
                    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    end: new Date().toISOString().split('T')[0]
                  })}
                >
                  Last 7 Days
                </button>
                <button 
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setDateRange({
                    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    end: new Date().toISOString().split('T')[0]
                  })}
                >
                  Last 30 Days
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div className="col-md-9">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                {reportTypes.find(r => r.id === activeReport)?.name}
              </h3>
              <div className="text-muted">
                {new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()}
              </div>
            </div>
            <div className="card-body">
              {/* Render different report components based on activeReport */}
              {activeReport === 'session-summary' && <SessionSummaryReport data={reportsData} />}
              {activeReport === 'participant-stats' && <ParticipantStatsReport data={reportsData} />}
              {activeReport === 'operator-activity' && <OperatorActivityReport data={reportsData} />}
              {activeReport === 'geographic-distribution' && <GeographicDistributionReport data={reportsData} />}
              {activeReport === 'traffic-report' && <TrafficReport data={reportsData} />}
              {activeReport === 'net-control-report' && <NetControlReport data={reportsData} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Session Summary Report Component
const SessionSummaryReport = ({ data }) => {
  if (!data) return <div>Loading...</div>;

  return (
    <div>
      {/* Summary Stats */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{data.summary?.total_sessions || 0}</h3>
                <p>Total Sessions</p>
              </div>
              <div className="stats-card-icon">
                <Calendar size={24} className="text-primary" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{data.summary?.total_participants || 0}</h3>
                <p>Total Check-ins</p>
              </div>
              <div className="stats-card-icon">
                <Users size={24} className="text-success" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{data.summary?.avg_participants || 0}</h3>
                <p>Avg per Session</p>
              </div>
              <div className="stats-card-icon">
                <TrendingUp size={24} className="text-info" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{data.summary?.total_traffic || 0}</h3>
                <p>Messages Handled</p>
              </div>
              <div className="stats-card-icon">
                <MessageSquare size={24} className="text-warning" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Net Control</th>
              <th>Frequency</th>
              <th>Participants</th>
              <th>Traffic</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {data.sessions?.map(session => (
              <tr key={session.id}>
                <td>{new Date(session.session_date).toLocaleDateString()}</td>
                <td>
                  <strong>{session.net_control_call}</strong>
                  {session.net_control_name && (
                    <div className="small text-muted">{session.net_control_name}</div>
                  )}
                </td>
                <td>{session.frequency || 'N/A'}</td>
                <td>
                  <span className="badge bg-primary">{session.participant_count}</span>
                </td>
                <td>
                  <span className="badge bg-info">{session.traffic_count}</span>
                </td>
                <td>
                  {session.start_time && session.end_time ? (
                    <div className="d-flex align-items-center">
                      <Clock size={12} className="me-1" />
                      {session.start_time} - {session.end_time}
                    </div>
                  ) : (
                    <span className="text-muted">N/A</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Participant Stats Report Component
const ParticipantStatsReport = ({ data }) => {
  if (!data) return <div>Loading...</div>;

  return (
    <div>
      {/* Summary Stats Row */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{data.trends?.unique_participants || 0}</h3>
                <p>Unique Participants</p>
              </div>
              <div className="stats-card-icon">
                <Users size={24} className="text-primary" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{data.trends?.new_participants || 0}</h3>
                <p>New Participants</p>
              </div>
              <div className="stats-card-icon">
                <TrendingUp size={24} className="text-success" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{data.trends?.returning_participants || 0}</h3>
                <p>Returning Participants</p>
              </div>
              <div className="stats-card-icon">
                <Users size={24} className="text-info" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Participants Table */}
      <div className="row">
        <div className="col-12">
          <h4 className="mb-3">Top Participants</h4>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Call Sign</th>
                  <th>Name</th>
                  <th>Sessions</th>
                  <th>Participation Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.top_participants?.map((participant, index) => (
                  <tr key={participant.call_sign}>
                    <td>
                      <span className="badge bg-secondary">#{index + 1}</span>
                    </td>
                    <td>
                      <strong>{participant.call_sign}</strong>
                    </td>
                    <td>{participant.name || 'N/A'}</td>
                    <td>
                      <span className="badge bg-primary">{participant.session_count}</span>
                    </td>
                    <td>
                      <div className="d-flex align-items-center">
                        <div className="progress me-2" style={{ height: '20px', minWidth: '100px' }}>
                          <div 
                            className="progress-bar" 
                            style={{ width: `${participant.participation_rate}%` }}
                          >
                            {participant.participation_rate}%
                          </div>
                        </div>
                        <span className="text-muted small">{participant.participation_rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// Operator Activity Report Component
const OperatorActivityReport = ({ data }) => {
  if (!data) return <div>Loading...</div>;

  const operators = data.operators || [];

  // Calculate summary statistics
  const totalOperators = operators.length;
  const totalSessions = operators.reduce((sum, op) => sum + (op.sessions_participated || 0), 0);
  const totalMessagesSent = operators.reduce((sum, op) => sum + (op.messages_sent || 0), 0);
  const totalMessagesReceived = operators.reduce((sum, op) => sum + (op.messages_received || 0), 0);
  const avgSessionsPerOperator = totalOperators > 0 ? (totalSessions / totalOperators).toFixed(1) : 0;

  // Get most active operators (top 5)
  const mostActiveOperators = [...operators]
    .sort((a, b) => (b.sessions_participated || 0) - (a.sessions_participated || 0))
    .slice(0, 5);

  // Get operators by license class
  const operatorsByClass = operators.reduce((acc, op) => {
    const licenseClass = op.class || 'Unknown';
    if (!acc[licenseClass]) {
      acc[licenseClass] = [];
    }
    acc[licenseClass].push(op);
    return acc;
  }, {});

  // Get message activity leaders
  const messageSenders = [...operators]
    .filter(op => (op.messages_sent || 0) > 0)
    .sort((a, b) => (b.messages_sent || 0) - (a.messages_sent || 0))
    .slice(0, 5);

  const messageReceivers = [...operators]
    .filter(op => (op.messages_received || 0) > 0)
    .sort((a, b) => (b.messages_received || 0) - (a.messages_received || 0))
    .slice(0, 5);

  return (
    <div>
      {/* Summary Statistics */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{totalOperators}</h3>
                <p>Active Operators</p>
              </div>
              <div className="stats-card-icon">
                <Users size={24} className="text-primary" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{totalSessions}</h3>
                <p>Total Participations</p>
              </div>
              <div className="stats-card-icon">
                <Radio size={24} className="text-success" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{totalMessagesSent + totalMessagesReceived}</h3>
                <p>Total Messages</p>
              </div>
              <div className="stats-card-icon">
                <MessageSquare size={24} className="text-info" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{avgSessionsPerOperator}</h3>
                <p>Avg Sessions/Operator</p>
              </div>
              <div className="stats-card-icon">
                <TrendingUp size={24} className="text-warning" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performers and License Class Distribution */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title">Most Active Operators</h5>
            </div>
            <div className="card-body">
              <div className="table-container">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Call Sign</th>
                      <th>Sessions</th>
                      <th>Messages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mostActiveOperators.map((operator, index) => (
                      <tr key={operator.call_sign}>
                        <td>
                          <span className="badge bg-secondary">#{index + 1}</span>
                        </td>
                        <td>
                          <div>
                            <strong>{operator.call_sign}</strong>
                            {operator.name && (
                              <div className="small text-muted">{operator.name}</div>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-primary">{operator.sessions_participated}</span>
                        </td>
                        <td>
                          <div className="small">
                            <div>📤 {operator.messages_sent || 0}</div>
                            <div>📥 {operator.messages_received || 0}</div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title">License Class Distribution</h5>
            </div>
            <div className="card-body">
              {Object.entries(operatorsByClass).map(([licenseClass, classOperators]) => (
                <div key={licenseClass} className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="fw-bold">{licenseClass}</span>
                    <span className="badge bg-info">{classOperators.length}</span>
                  </div>
                  <div className="progress" style={{ height: '20px' }}>
                    <div 
                      className="progress-bar" 
                      style={{ width: `${(classOperators.length / totalOperators) * 100}%` }}
                    >
                      {Math.round((classOperators.length / totalOperators) * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Message Activity Leaders */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title">Top Message Senders</h5>
            </div>
            <div className="card-body">
              {messageSenders.length > 0 ? (
                <div className="table-container">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Call Sign</th>
                        <th>Messages Sent</th>
                        <th>Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {messageSenders.map((operator) => (
                        <tr key={operator.call_sign}>
                          <td>
                            <strong>{operator.call_sign}</strong>
                            {operator.name && (
                              <div className="small text-muted">{operator.name}</div>
                            )}
                          </td>
                          <td>
                            <span className="badge bg-success">{operator.messages_sent}</span>
                          </td>
                          <td>
                            <span className="badge bg-outline-primary">{operator.sessions_participated}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted">No message activity recorded</p>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title">Top Message Recipients</h5>
            </div>
            <div className="card-body">
              {messageReceivers.length > 0 ? (
                <div className="table-container">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Call Sign</th>
                        <th>Messages Received</th>
                        <th>Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {messageReceivers.map((operator) => (
                        <tr key={operator.call_sign}>
                          <td>
                            <strong>{operator.call_sign}</strong>
                            {operator.name && (
                              <div className="small text-muted">{operator.name}</div>
                            )}
                          </td>
                          <td>
                            <span className="badge bg-info">{operator.messages_received}</span>
                          </td>
                          <td>
                            <span className="badge bg-outline-primary">{operator.sessions_participated}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted">No message activity recorded</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Operator Activity Table */}
      <div className="card">
        <div className="card-header">
          <h5 className="card-title">Detailed Operator Activity</h5>
        </div>
        <div className="card-body">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Call Sign</th>
                  <th>Operator</th>
                  <th>License</th>
                  <th>Location</th>
                  <th>Sessions</th>
                  <th>Messages</th>
                  <th>Activity Period</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((operator) => (
                  <tr key={operator.call_sign}>
                    <td>
                      <div className="d-flex align-items-center">
                        <Radio size={16} className="text-primary me-2" />
                        <strong>{operator.call_sign}</strong>
                      </div>
                    </td>
                    <td>
                      {operator.name ? (
                        <div>
                          <div>{operator.name}</div>
                        </div>
                      ) : (
                        <span className="text-muted">No name</span>
                      )}
                    </td>
                    <td>
                      {operator.class ? (
                        <span className="badge bg-info">{operator.class}</span>
                      ) : (
                        <span className="text-muted small">Unknown</span>
                      )}
                    </td>
                    <td>
                      {operator.location ? (
                        <div className="small">
                          <MapPin size={12} className="me-1" />
                          {operator.location}
                        </div>
                      ) : (
                        <span className="text-muted small">No location</span>
                      )}
                    </td>
                    <td>
                      <span className="badge bg-primary">{operator.sessions_participated}</span>
                    </td>
                    <td>
                      <div className="small">
                        <div className="d-flex align-items-center mb-1">
                          <span className="me-2">📤</span>
                          <span className="badge bg-success me-2">{operator.messages_sent || 0}</span>
                          <span className="text-muted">sent</span>
                        </div>
                        <div className="d-flex align-items-center">
                          <span className="me-2">📥</span>
                          <span className="badge bg-info me-2">{operator.messages_received || 0}</span>
                          <span className="text-muted">received</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="small">
                        {operator.first_participation && (
                          <div className="d-flex align-items-center mb-1">
                            <Calendar size={12} className="me-1 text-muted" />
                            <span>First: {new Date(operator.first_participation).toLocaleDateString()}</span>
                          </div>
                        )}
                        {operator.last_participation && (
                          <div className="d-flex align-items-center">
                            <Calendar size={12} className="me-1 text-muted" />
                            <span>Last: {new Date(operator.last_participation).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {operators.length === 0 && (
            <div className="text-center py-4">
              <Users size={48} className="text-muted mb-3" />
              <p className="text-muted">No operator activity found for the selected date range</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const GeographicDistributionReport = ({ data }) => {
  if (!data) return <div>Loading...</div>;

  const locations = data.locations || [];

  // Calculate summary statistics
  const totalLocations = locations.length;
  const totalOperators = locations.reduce((sum, loc) => sum + (loc.unique_operators || 0), 0);
  const totalParticipations = locations.reduce((sum, loc) => sum + (loc.total_participations || 0), 0);
  const avgOperatorsPerLocation = totalLocations > 0 ? (totalOperators / totalLocations).toFixed(1) : 0;

  // Sort locations by participation activity
  const sortedByParticipation = [...locations].sort((a, b) => 
    (b.total_participations || 0) - (a.total_participations || 0)
  );

  // Get top 10 most active locations
  const topActiveLocations = sortedByParticipation.slice(0, 10);

  // Parse locations to identify states/regions
  const locationsByState = locations.reduce((acc, loc) => {
    // Try to extract state from location string (assuming format like "City, State" or "City, ST")
    const locationParts = loc.location.split(',').map(part => part.trim());
    const state = locationParts.length > 1 ? locationParts[locationParts.length - 1] : 'Unknown';
    
    if (!acc[state]) {
      acc[state] = {
        locations: [],
        totalOperators: 0,
        totalParticipations: 0
      };
    }
    
    acc[state].locations.push(loc);
    acc[state].totalOperators += loc.unique_operators || 0;
    acc[state].totalParticipations += loc.total_participations || 0;
    
    return acc;
  }, {});

  // Sort states by activity
  const statesSorted = Object.entries(locationsByState)
    .map(([state, data]) => ({ state, ...data }))
    .sort((a, b) => b.totalParticipations - a.totalParticipations);

  // Calculate participation density (participations per operator)
  const locationsWithDensity = locations.map(loc => ({
    ...loc,
    participationDensity: loc.unique_operators > 0 ? 
      (loc.total_participations / loc.unique_operators).toFixed(1) : 0
  })).sort((a, b) => parseFloat(b.participationDensity) - parseFloat(a.participationDensity));

  return (
    <div>
      {/* Summary Statistics */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{totalLocations}</h3>
                <p>Active Locations</p>
              </div>
              <div className="stats-card-icon">
                <MapPin size={24} className="text-primary" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{totalOperators}</h3>
                <p>Total Operators</p>
              </div>
              <div className="stats-card-icon">
                <Users size={24} className="text-success" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{totalParticipations}</h3>
                <p>Total Participations</p>
              </div>
              <div className="stats-card-icon">
                <Radio size={24} className="text-info" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{avgOperatorsPerLocation}</h3>
                <p>Avg Operators/Location</p>
              </div>
              <div className="stats-card-icon">
                <TrendingUp size={24} className="text-warning" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Active Locations and State Distribution */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title">
                <MapPin size={16} className="me-2" />
                Most Active Locations
              </h5>
            </div>
            <div className="card-body">
              <div className="table-container">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Location</th>
                      <th>Operators</th>
                      <th>Participations</th>
                      <th>Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topActiveLocations.map((location, index) => {
                      const density = location.unique_operators > 0 ? 
                        (location.total_participations / location.unique_operators).toFixed(1) : 0;
                      return (
                        <tr key={location.location}>
                          <td>
                            <span className="badge bg-secondary">#{index + 1}</span>
                          </td>
                          <td>
                            <div className="small">
                              <strong>{location.location}</strong>
                            </div>
                          </td>
                          <td>
                            <span className="badge bg-primary">{location.unique_operators}</span>
                          </td>
                          <td>
                            <span className="badge bg-success">{location.total_participations}</span>
                          </td>
                          <td>
                            <div className="progress" style={{ height: '16px', minWidth: '60px' }}>
                              <div 
                                className="progress-bar bg-info" 
                                style={{ width: `${Math.min((parseFloat(density) / 10) * 100, 100)}%` }}
                                title={`${density} participations per operator`}
                              >
                                {density}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title">
                <Map size={16} className="me-2" />
                Distribution by State/Region
              </h5>
            </div>
            <div className="card-body">
              {statesSorted.slice(0, 8).map((stateData) => (
                <div key={stateData.state} className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <div>
                      <span className="fw-bold">{stateData.state}</span>
                      <span className="text-muted small ms-2">
                        ({stateData.locations.length} locations)
                      </span>
                    </div>
                    <div className="d-flex gap-2">
                      <span className="badge bg-primary">{stateData.totalOperators} ops</span>
                      <span className="badge bg-success">{stateData.totalParticipations} parts</span>
                    </div>
                  </div>
                  <div className="progress" style={{ height: '20px' }}>
                    <div 
                      className="progress-bar" 
                      style={{ width: `${(stateData.totalParticipations / totalParticipations) * 100}%` }}
                    >
                      {Math.round((stateData.totalParticipations / totalParticipations) * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Participation Density Analysis */}
      <div className="row mb-4">
        <div className="col-md-12">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title">
                <TrendingUp size={16} className="me-2" />
                Participation Density Analysis
              </h5>
              <small className="text-muted">Average participations per operator by location</small>
            </div>
            <div className="card-body">
              <div className="row">
                {locationsWithDensity.slice(0, 12).map((location, index) => (
                  <div key={location.location} className="col-md-4 mb-3">
                    <div className="card border-0 bg-light">
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="flex-grow-1">
                            <h6 className="card-title mb-1 small">{location.location}</h6>
                            <div className="small text-muted">
                              {location.unique_operators} operators
                            </div>
                          </div>
                          <div className="text-end">
                            <div className="h5 mb-0 text-primary">{location.participationDensity}</div>
                            <div className="small text-muted">avg/op</div>
                          </div>
                        </div>
                        <div className="progress" style={{ height: '6px' }}>
                          <div 
                            className="progress-bar bg-primary" 
                            style={{ width: `${Math.min((parseFloat(location.participationDensity) / 10) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Geographic Distribution Table */}
      <div className="card">
        <div className="card-header">
          <h5 className="card-title">
            <MapPin size={16} className="me-2" />
            Complete Geographic Distribution
          </h5>
        </div>
        <div className="card-body">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Unique Operators</th>
                  <th>Total Participations</th>
                  <th>Participation Density</th>
                  <th>Activity Level</th>
                  <th>Coverage</th>
                </tr>
              </thead>
              <tbody>
                {sortedByParticipation.map((location) => {
                  const density = location.unique_operators > 0 ? 
                    (location.total_participations / location.unique_operators).toFixed(1) : 0;
                  const coveragePercent = ((location.total_participations / totalParticipations) * 100).toFixed(1);
                  
                  return (
                    <tr key={location.location}>
                      <td>
                        <div className="d-flex align-items-center">
                          <MapPin size={16} className="text-primary me-2" />
                          <div>
                            <strong>{location.location}</strong>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-primary">{location.unique_operators}</span>
                      </td>
                      <td>
                        <span className="badge bg-success">{location.total_participations}</span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <span className="me-2">{density}</span>
                          <div className="progress" style={{ height: '16px', minWidth: '60px' }}>
                            <div 
                              className="progress-bar bg-info" 
                              style={{ width: `${Math.min((parseFloat(density) / 10) * 100, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {location.total_participations >= 20 && (
                          <span className="badge bg-success">High</span>
                        )}
                        {location.total_participations >= 10 && location.total_participations < 20 && (
                          <span className="badge bg-warning">Medium</span>
                        )}
                        {location.total_participations < 10 && (
                          <span className="badge bg-secondary">Low</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <span className="small me-2">{coveragePercent}%</span>
                          <div className="progress" style={{ height: '12px', minWidth: '50px' }}>
                            <div 
                              className="progress-bar bg-primary" 
                              style={{ width: `${coveragePercent}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {locations.length === 0 && (
            <div className="text-center py-4">
              <MapPin size={48} className="text-muted mb-3" />
              <p className="text-muted">No geographic data found for the selected date range</p>
              <p className="text-muted small">
                Geographic data requires operators to have location information in their profiles
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TrafficReport = ({ data }) => {
  if (!data) return <div>Loading...</div>;

  const summary = data.summary || {};
  const bySession = data.by_session || [];

  // Calculate additional metrics
  const totalMessages = summary.total_messages || 0;
  const emergencyMessages = summary.emergency_messages || 0;
  const priorityMessages = summary.priority_messages || 0;
  const welfareMessages = summary.welfare_messages || 0;
  const routineMessages = summary.routine_messages || 0;

  // Calculate percentages
  const emergencyPercent = totalMessages > 0 ? ((emergencyMessages / totalMessages) * 100).toFixed(1) : 0;
  const priorityPercent = totalMessages > 0 ? ((priorityMessages / totalMessages) * 100).toFixed(1) : 0;
  const welfarePercent = totalMessages > 0 ? ((welfareMessages / totalMessages) * 100).toFixed(1) : 0;
  const routinePercent = totalMessages > 0 ? ((routineMessages / totalMessages) * 100).toFixed(1) : 0;

  // Sort sessions by message count
  const sortedSessions = [...bySession].sort((a, b) => (b.message_count || 0) - (a.message_count || 0));
  
  // Get sessions with emergency traffic
  const emergencySessions = bySession.filter(session => (session.emergency_count || 0) > 0);
  
  // Get sessions with priority traffic
  const prioritySessions = bySession.filter(session => (session.priority_count || 0) > 0);

  // Calculate average messages per session
  const avgMessagesPerSession = bySession.length > 0 ? 
    (totalMessages / bySession.length).toFixed(1) : 0;

  // Get busiest sessions (top 5)
  const busiestSessions = sortedSessions.slice(0, 5);

  return (
    <div>
      {/* Summary Statistics */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{totalMessages}</h3>
                <p>Total Messages</p>
              </div>
              <div className="stats-card-icon">
                <MessageSquare size={24} className="text-primary" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{emergencyMessages}</h3>
                <p>Emergency Messages</p>
              </div>
              <div className="stats-card-icon">
                <MessageSquare size={24} className="text-danger" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{priorityMessages}</h3>
                <p>Priority Messages</p>
              </div>
              <div className="stats-card-icon">
                <MessageSquare size={24} className="text-warning" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{avgMessagesPerSession}</h3>
                <p>Avg Messages/Session</p>
              </div>
              <div className="stats-card-icon">
                <TrendingUp size={24} className="text-info" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Message Type Distribution and Critical Traffic */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title">
                <BarChart3 size={16} className="me-2" />
                Message Type Distribution
              </h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="fw-bold text-danger">Emergency</span>
                  <span className="badge bg-danger">{emergencyMessages} ({emergencyPercent}%)</span>
                </div>
                <div className="progress mb-2" style={{ height: '20px' }}>
                  <div 
                    className="progress-bar bg-danger" 
                    style={{ width: `${emergencyPercent}%` }}
                  >
                    {emergencyPercent > 5 ? `${emergencyPercent}%` : ''}
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="fw-bold text-warning">Priority</span>
                  <span className="badge bg-warning">{priorityMessages} ({priorityPercent}%)</span>
                </div>
                <div className="progress mb-2" style={{ height: '20px' }}>
                  <div 
                    className="progress-bar bg-warning" 
                    style={{ width: `${priorityPercent}%` }}
                  >
                    {priorityPercent > 5 ? `${priorityPercent}%` : ''}
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="fw-bold text-info">Welfare</span>
                  <span className="badge bg-info">{welfareMessages} ({welfarePercent}%)</span>
                </div>
                <div className="progress mb-2" style={{ height: '20px' }}>
                  <div 
                    className="progress-bar bg-info" 
                    style={{ width: `${welfarePercent}%` }}
                  >
                    {welfarePercent > 5 ? `${welfarePercent}%` : ''}
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="fw-bold text-secondary">Routine</span>
                  <span className="badge bg-secondary">{routineMessages} ({routinePercent}%)</span>
                </div>
                <div className="progress mb-2" style={{ height: '20px' }}>
                  <div 
                    className="progress-bar bg-secondary" 
                    style={{ width: `${routinePercent}%` }}
                  >
                    {routinePercent > 5 ? `${routinePercent}%` : ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title">
                <MessageSquare size={16} className="me-2 text-danger" />
                Critical Traffic Sessions
              </h5>
            </div>
            <div className="card-body">
              {emergencySessions.length > 0 && (
                <div className="mb-3">
                  <h6 className="text-danger">Emergency Traffic</h6>
                  {emergencySessions.slice(0, 5).map((session) => (
                    <div key={`emergency-${session.session_date}-${session.net_control_call}`} className="d-flex justify-content-between align-items-center mb-2 p-2 bg-danger bg-opacity-10 rounded">
                      <div>
                        <strong>{new Date(session.session_date).toLocaleDateString()}</strong>
                        <div className="small text-muted">{session.net_control_call}</div>
                      </div>
                      <span className="badge bg-danger">{session.emergency_count} emergency</span>
                    </div>
                  ))}
                </div>
              )}

              {prioritySessions.length > 0 && (
                <div className="mb-3">
                  <h6 className="text-warning">Priority Traffic</h6>
                  {prioritySessions.slice(0, 5).map((session) => (
                    <div key={`priority-${session.session_date}-${session.net_control_call}`} className="d-flex justify-content-between align-items-center mb-2 p-2 bg-warning bg-opacity-10 rounded">
                      <div>
                        <strong>{new Date(session.session_date).toLocaleDateString()}</strong>
                        <div className="small text-muted">{session.net_control_call}</div>
                      </div>
                      <span className="badge bg-warning">{session.priority_count} priority</span>
                    </div>
                  ))}
                </div>
              )}

              {emergencySessions.length === 0 && prioritySessions.length === 0 && (
                <div className="text-center py-3">
                  <MessageSquare size={32} className="text-muted mb-2" />
                  <p className="text-muted">No critical traffic recorded</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Busiest Sessions */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title">
                <TrendingUp size={16} className="me-2" />
                Busiest Sessions
              </h5>
            </div>
            <div className="card-body">
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Date</th>
                      <th>Net Control</th>
                      <th>Total Messages</th>
                      <th>Emergency</th>
                      <th>Priority</th>
                      <th>Activity Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {busiestSessions.map((session, index) => (
                      <tr key={`${session.session_date}-${session.net_control_call}`}>
                        <td>
                          <span className="badge bg-secondary">#{index + 1}</span>
                        </td>
                        <td>
                          <strong>{new Date(session.session_date).toLocaleDateString()}</strong>
                        </td>
                        <td>
                          <div>
                            <strong>{session.net_control_call}</strong>
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-primary">{session.message_count}</span>
                        </td>
                        <td>
                          {session.emergency_count > 0 ? (
                            <span className="badge bg-danger">{session.emergency_count}</span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>
                          {session.priority_count > 0 ? (
                            <span className="badge bg-warning">{session.priority_count}</span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>
                          {session.message_count >= 20 && (
                            <span className="badge bg-success">High</span>
                          )}
                          {session.message_count >= 10 && session.message_count < 20 && (
                            <span className="badge bg-warning">Medium</span>
                          )}
                          {session.message_count < 10 && (
                            <span className="badge bg-secondary">Low</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Complete Session Traffic Table */}
      <div className="card">
        <div className="card-header">
          <h5 className="card-title">
            <MessageSquare size={16} className="me-2" />
            Session Traffic Summary
          </h5>
        </div>
        <div className="card-body">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Net Control</th>
                  <th>Total Messages</th>
                  <th>Emergency</th>
                  <th>Priority</th>
                  <th>Traffic Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.map((session) => (
                  <tr key={`${session.session_date}-${session.net_control_call}`}>
                    <td>
                      <div className="d-flex align-items-center">
                        <Calendar size={16} className="text-muted me-2" />
                        <strong>{new Date(session.session_date).toLocaleDateString()}</strong>
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong>{session.net_control_call}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="badge bg-primary">{session.message_count}</span>
                    </td>
                    <td>
                      {session.emergency_count > 0 ? (
                        <span className="badge bg-danger">{session.emergency_count}</span>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                    <td>
                      {session.priority_count > 0 ? (
                        <span className="badge bg-warning">{session.priority_count}</span>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                    <td>
                      <div className="d-flex align-items-center">
                        {session.message_count > 0 ? (
                          <div className="progress" style={{ height: '16px', minWidth: '100px' }}>
                            <div 
                              className="progress-bar bg-danger" 
                              style={{ width: `${((session.emergency_count || 0) / session.message_count) * 100}%` }}
                              title={`${session.emergency_count || 0} Emergency`}
                            ></div>
                            <div 
                              className="progress-bar bg-warning" 
                              style={{ width: `${((session.priority_count || 0) / session.message_count) * 100}%` }}
                              title={`${session.priority_count || 0} Priority`}
                            ></div>
                            <div 
                              className="progress-bar bg-secondary" 
                              style={{ width: `${(((session.message_count - (session.emergency_count || 0) - (session.priority_count || 0)) / session.message_count) * 100)}%` }}
                              title="Other Traffic"
                            ></div>
                          </div>
                        ) : (
                          <span className="text-muted">No traffic</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {bySession.length === 0 && (
            <div className="text-center py-4">
              <MessageSquare size={48} className="text-muted mb-3" />
              <p className="text-muted">No traffic data found for the selected date range</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const NetControlReport = ({ data }) => {
  if (!data) return <div>Loading...</div>;

  const netControlStats = data.net_control_stats || [];

  // Calculate summary statistics
  const totalNetControls = netControlStats.length;
  const totalSessionsControlled = netControlStats.reduce((sum, nc) => sum + (nc.sessions_controlled || 0), 0);
  const totalParticipantsManaged = netControlStats.reduce((sum, nc) => sum + (nc.total_participants_managed || 0), 0);
  const totalTrafficHandled = netControlStats.reduce((sum, nc) => sum + (nc.total_traffic_handled || 0), 0);

  // Calculate averages
  const avgSessionsPerNetControl = totalNetControls > 0 ? (totalSessionsControlled / totalNetControls).toFixed(1) : 0;
  const avgParticipantsPerSession = totalSessionsControlled > 0 ? (totalParticipantsManaged / totalSessionsControlled).toFixed(1) : 0;
  const avgTrafficPerSession = totalSessionsControlled > 0 ? (totalTrafficHandled / totalSessionsControlled).toFixed(1) : 0;

  // Sort by different metrics
  const sortedBySessionsControlled = [...netControlStats].sort((a, b) => (b.sessions_controlled || 0) - (a.sessions_controlled || 0));
  const sortedByParticipants = [...netControlStats].sort((a, b) => (b.total_participants_managed || 0) - (a.total_participants_managed || 0));
  const sortedByTraffic = [...netControlStats].sort((a, b) => (b.total_traffic_handled || 0) - (a.total_traffic_handled || 0));

  // Get top performers
  const topByExperience = sortedBySessionsControlled.slice(0, 5);
  const topByParticipants = sortedByParticipants.slice(0, 5);
  const topByTraffic = sortedByTraffic.slice(0, 5);

  // Calculate efficiency metrics
  const netControlsWithEfficiency = netControlStats.map(nc => ({
    ...nc,
    participantEfficiency: nc.sessions_controlled > 0 ? 
      ((nc.total_participants_managed || 0) / nc.sessions_controlled).toFixed(1) : 0,
    trafficEfficiency: nc.sessions_controlled > 0 ? 
      ((nc.total_traffic_handled || 0) / nc.sessions_controlled).toFixed(1) : 0
  })).sort((a, b) => parseFloat(b.participantEfficiency) - parseFloat(a.participantEfficiency));

  return (
    <div>
      {/* Summary Statistics */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{totalNetControls}</h3>
                <p>Net Control Operators</p>
              </div>
              <div className="stats-card-icon">
                <Radio size={24} className="text-primary" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{totalSessionsControlled}</h3>
                <p>Sessions Controlled</p>
              </div>
              <div className="stats-card-icon">
                <Calendar size={24} className="text-success" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{totalParticipantsManaged}</h3>
                <p>Participants Managed</p>
              </div>
              <div className="stats-card-icon">
                <Users size={24} className="text-info" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{totalTrafficHandled}</h3>
                <p>Messages Handled</p>
              </div>
              <div className="stats-card-icon">
                <MessageSquare size={24} className="text-warning" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{avgSessionsPerNetControl}</h3>
                <p>Avg Sessions per Net Control</p>
              </div>
              <div className="stats-card-icon">
                <TrendingUp size={24} className="text-primary" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{avgParticipantsPerSession}</h3>
                <p>Avg Participants per Session</p>
              </div>
              <div className="stats-card-icon">
                <Users size={24} className="text-success" />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{avgTrafficPerSession}</h3>
                <p>Avg Messages per Session</p>
              </div>
              <div className="stats-card-icon">
                <MessageSquare size={24} className="text-info" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performers */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title">
                <Calendar size={16} className="me-2" />
                Most Experienced
              </h5>
              <small className="text-muted">By sessions controlled</small>
            </div>
            <div className="card-body">
              {topByExperience.map((nc, index) => (
                <div key={nc.net_control_call} className="d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded">
                  <div>
                    <div className="d-flex align-items-center">
                      <span className="badge bg-secondary me-2">#{index + 1}</span>
                      <strong>{nc.net_control_call}</strong>
                    </div>
                    {nc.net_control_name && (
                      <div className="small text-muted">{nc.net_control_name}</div>
                    )}
                  </div>
                  <span className="badge bg-primary">{nc.sessions_controlled}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title">
                <Users size={16} className="me-2" />
                Best Participation
              </h5>
              <small className="text-muted">By participants managed</small>
            </div>
            <div className="card-body">
              {topByParticipants.map((nc, index) => (
                <div key={nc.net_control_call} className="d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded">
                  <div>
                    <div className="d-flex align-items-center">
                      <span className="badge bg-secondary me-2">#{index + 1}</span>
                      <strong>{nc.net_control_call}</strong>
                    </div>
                    {nc.net_control_name && (
                      <div className="small text-muted">{nc.net_control_name}</div>
                    )}
                  </div>
                  <span className="badge bg-success">{nc.total_participants_managed}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title">
                <MessageSquare size={16} className="me-2" />
                Most Traffic
              </h5>
              <small className="text-muted">By messages handled</small>
            </div>
            <div className="card-body">
              {topByTraffic.map((nc, index) => (
                <div key={nc.net_control_call} className="d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded">
                  <div>
                    <div className="d-flex align-items-center">
                      <span className="badge bg-secondary me-2">#{index + 1}</span>
                      <strong>{nc.net_control_call}</strong>
                    </div>
                    {nc.net_control_name && (
                      <div className="small text-muted">{nc.net_control_name}</div>
                    )}
                  </div>
                  <span className="badge bg-warning">{nc.total_traffic_handled}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Efficiency Analysis */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title">
                <TrendingUp size={16} className="me-2" />
                Net Control Efficiency Analysis
              </h5>
              <small className="text-muted">Average performance per session</small>
            </div>
            <div className="card-body">
              <div className="row">
                {netControlsWithEfficiency.slice(0, 6).map((nc) => (
                  <div key={nc.net_control_call} className="col-md-4 mb-3">
                    <div className="card border-0 bg-light">
                      <div className="card-body p-3">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="flex-grow-1">
                            <h6 className="card-title mb-1">{nc.net_control_call}</h6>
                            {nc.net_control_name && (
                              <div className="small text-muted">{nc.net_control_name}</div>
                            )}
                            <div className="small text-muted">{nc.sessions_controlled} sessions</div>
                          </div>
                        </div>
                        <div className="row text-center">
                          <div className="col-6">
                            <div className="h5 mb-0 text-success">{nc.participantEfficiency}</div>
                            <div className="small text-muted">participants/session</div>
                          </div>
                          <div className="col-6">
                            <div className="h5 mb-0 text-info">{nc.trafficEfficiency}</div>
                            <div className="small text-muted">messages/session</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Complete Net Control Statistics Table */}
      <div className="card">
        <div className="card-header">
          <h5 className="card-title">
            <Radio size={16} className="me-2" />
            Complete Net Control Statistics
          </h5>
        </div>
        <div className="card-body">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Net Control</th>
                  <th>Sessions</th>
                  <th>Participants</th>
                  <th>Traffic</th>
                  <th>Avg Participants</th>
                  <th>Avg Traffic</th>
                  <th>Performance</th>
                </tr>
              </thead>
              <tbody>
                {sortedBySessionsControlled.map((nc) => {
                  const participantEfficiency = nc.sessions_controlled > 0 ? 
                    ((nc.total_participants_managed || 0) / nc.sessions_controlled).toFixed(1) : 0;
                  const trafficEfficiency = nc.sessions_controlled > 0 ? 
                    ((nc.total_traffic_handled || 0) / nc.sessions_controlled).toFixed(1) : 0;
                  
                  return (
                    <tr key={nc.net_control_call}>
                      <td>
                        <div className="d-flex align-items-center">
                          <Radio size={16} className="text-primary me-2" />
                          <div>
                            <strong>{nc.net_control_call}</strong>
                            {nc.net_control_name && (
                              <div className="small text-muted">{nc.net_control_name}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-primary">{nc.sessions_controlled}</span>
                      </td>
                      <td>
                        <span className="badge bg-success">{nc.total_participants_managed || 0}</span>
                      </td>
                      <td>
                        <span className="badge bg-warning">{nc.total_traffic_handled || 0}</span>
                      </td>
                      <td>
                        <span className="text-success">{participantEfficiency}</span>
                      </td>
                      <td>
                        <span className="text-info">{trafficEfficiency}</span>
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          {nc.sessions_controlled >= 10 && (
                            <span className="badge bg-success">Experienced</span>
                          )}
                          {parseFloat(participantEfficiency) >= parseFloat(avgParticipantsPerSession) && (
                            <span className="badge bg-info">High Participation</span>
                          )}
                          {parseFloat(trafficEfficiency) >= parseFloat(avgTrafficPerSession) && (
                            <span className="badge bg-warning">High Traffic</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {netControlStats.length === 0 && (
            <div className="text-center py-4">
              <Radio size={48} className="text-muted mb-3" />
              <p className="text-muted">No net control data found for the selected date range</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;