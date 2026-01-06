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
  MessageSquare
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
      <div className="row mb-4">
        <div className="col-md-6">
          <h4>Top Participants</h4>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
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
                      <div className="d-flex align-items-center">
                        <span className="badge bg-secondary me-2">#{index + 1}</span>
                        <strong>{participant.call_sign}</strong>
                      </div>
                    </td>
                    <td>{participant.name || 'N/A'}</td>
                    <td>
                      <span className="badge bg-primary">{participant.session_count}</span>
                    </td>
                    <td>
                      <div className="progress" style={{ height: '20px' }}>
                        <div 
                          className="progress-bar" 
                          style={{ width: `${participant.participation_rate}%` }}
                        >
                          {participant.participation_rate}%
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="col-md-6">
          <h4>Participation Trends</h4>
          <div className="stats-card mb-3">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{data.trends?.unique_participants || 0}</h3>
                <p>Unique Participants</p>
              </div>
            </div>
          </div>
          <div className="stats-card mb-3">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{data.trends?.new_participants || 0}</h3>
                <p>New Participants</p>
              </div>
            </div>
          </div>
          <div className="stats-card">
            <div className="stats-card-content">
              <div className="stats-card-info">
                <h3>{data.trends?.returning_participants || 0}</h3>
                <p>Returning Participants</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Placeholder components for other reports
const OperatorActivityReport = ({ data }) => (
  <div>
    <h4>Operator Activity Report</h4>
    <p className="text-muted">Individual operator participation details coming soon...</p>
  </div>
);

const GeographicDistributionReport = ({ data }) => (
  <div>
    <h4>Geographic Distribution Report</h4>
    <p className="text-muted">Participant location analysis coming soon...</p>
  </div>
);

const TrafficReport = ({ data }) => (
  <div>
    <h4>Traffic Report</h4>
    <p className="text-muted">Message traffic analysis coming soon...</p>
  </div>
);

const NetControlReport = ({ data }) => (
  <div>
    <h4>Net Control Report</h4>
    <p className="text-muted">Net control operator statistics coming soon...</p>
  </div>
);

export default Reports;