import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { 
  FileText, 
  Download, 
  Calendar,
  TrendingUp,
  Users,
  Award,
  BarChart3,
  Radio,
  MapPin,
  MessageSquare,
  Filter,
  Printer,
  Clock,
  AlertCircle,
  Mail
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { formatDateLocal } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';

const Reports = () => {
  const { isAdmin } = useAuth();
  const [activeReport, setActiveReport] = useState('monthly-net-control');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(0); // Last day of current month
    return date.toISOString().split('T')[0];
  });

  const [reportGenerated, setReportGenerated] = useState(false);

  const reportTypes = [
    {
      id: 'monthly-net-control',
      name: 'Monthly Net Control Report',
      icon: BarChart3,
      description: 'Comprehensive monthly activity report'
    },
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
      id: 'net-controller-contacts',
      name: 'Net Controller Contacts',
      icon: Award,
      description: 'Contact details for all net controllers'
    },
    {
      id: 'nc-statistics',
      name: 'NC Statistics',
      icon: BarChart3,
      description: 'Net controller performance statistics'
    }
  ];

  // Fetch monthly net control report
  const { data: monthlyReportData, isLoading: monthlyLoading, refetch: refetchMonthly } = useQuery(
    ['monthly-report', startDate, endDate],
    () => axios.get('/api/reports/monthly-net-control', {
      params: { start_date: startDate, end_date: endDate }
    }).then(res => res.data),
    {
      enabled: activeReport === 'monthly-net-control' && reportGenerated,
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to generate report');
      }
    }
  );

  // Fetch other reports
  const { data: reportsData, isLoading: reportsLoading } = useQuery(
    ['reports', activeReport, startDate, endDate],
    () => axios.get(`/api/reports/${activeReport}`, {
      params: {
        start_date: startDate,
        end_date: endDate
      }
    }).then(res => res.data),
    {
      enabled: activeReport !== 'monthly-net-control'
    }
  );

  const isLoading = activeReport === 'monthly-net-control' ? monthlyLoading : reportsLoading;
  const report = monthlyReportData?.report;

  const handleGenerateReport = () => {
    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }
    if (activeReport === 'monthly-net-control') {
      setReportGenerated(true);
      refetchMonthly();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSetCurrentMonth = () => {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  };

  const handleSetLastMonth = () => {
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth(), 0);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  };

  const handleSetLast7Days = () => {
    setStartDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
  };

  const handleSetLast30Days = () => {
    setStartDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
  };

  // Monthly email report mutation (admin only)
  const sendMonthlyEmailMutation = useMutation(
    (recipientEmail) => axios.post('/api/reports/send-monthly-email', { recipient_email: recipientEmail }),
    {
      onSuccess: (response) => {
        toast.success(response.data.message);
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to send monthly report email');
      }
    }
  );

  // Fetch default ARRL section email from settings
  const { data: arrlEmail } = useQuery(
    'arrl-section-email',
    () => axios.get('/api/settings').then(res => res.data.settings?.arrl_section_email || ''),
    { enabled: isAdmin() }
  );

  const handleSendMonthlyEmail = () => {
    const defaultEmail = arrlEmail || '';
    const email = prompt('Send monthly net report to:', defaultEmail);
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendMonthlyEmailMutation.mutate(email);
    } else if (email) {
      toast.error('Please enter a valid email address');
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="row mb-4 no-print">
        <div className="col">
          <h2 className="mb-0">
            <FileText className="me-2" size={32} />
            Reports
          </h2>
          <p className="text-muted">Generate and view net control reports</p>
          {isAdmin() && (
            <button
              className="btn btn-outline-primary mt-2"
              onClick={handleSendMonthlyEmail}
              disabled={sendMonthlyEmailMutation.isLoading}
            >
              <Mail size={16} className="me-2" />
              {sendMonthlyEmailMutation.isLoading ? 'Sending...' : 'Email Monthly Report'}
            </button>
          )}
        </div>
      </div>

      <div className="row reports-main-row">
        {/* Report Type Selector */}
        <div className="col-md-3 no-print">
          <div className="card mb-3">
            <div className="card-header">
              <h5 className="mb-0">Report Types</h5>
            </div>
            <div className="card-body p-0">
              <div className="list-group list-group-flush">
                {reportTypes.map(reportType => {
                  const IconComponent = reportType.icon;
                  return (
                    <button
                      key={reportType.id}
                      className={`list-group-item list-group-item-action ${
                        activeReport === reportType.id ? 'active' : ''
                      }`}
                      onClick={() => {
                        setActiveReport(reportType.id);
                        setReportGenerated(false);
                      }}
                    >
                      <div className="d-flex align-items-start">
                        <IconComponent size={16} className="me-2 mt-1" />
                        <div>
                          <div className="fw-bold">{reportType.name}</div>
                          <div className="small text-muted">{reportType.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">
                <Filter size={16} className="me-2" />
                Date Range
              </h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="d-grid gap-2">
                <button 
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleSetLast7Days}
                >
                  Last 7 Days
                </button>
                <button 
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleSetLast30Days}
                >
                  Last 30 Days
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleSetCurrentMonth}
                >
                  Current Month
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handleSetLastMonth}
                >
                  Last Month
                </button>
                {activeReport === 'monthly-net-control' && (
                  <button
                    className="btn btn-primary"
                    onClick={handleGenerateReport}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Generating...' : 'Generate Report'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div className="col-md-9">
          {activeReport === 'monthly-net-control' ? (
            <MonthlyNetControlReport 
              report={report}
              isLoading={isLoading}
              reportGenerated={reportGenerated}
              startDate={startDate}
              endDate={endDate}
              onPrint={handlePrint}
            />
          ) : (
            <OtherReports 
              activeReport={activeReport}
              reportTypes={reportTypes}
              data={reportsData}
              isLoading={isLoading}
              startDate={startDate}
              endDate={endDate}
              onPrint={handlePrint}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Monthly Net Control Report Component
const MonthlyNetControlReport = ({ report, isLoading, reportGenerated, startDate, endDate, onPrint }) => {
  if (isLoading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Generating report...</p>
      </div>
    );
  }

  if (!report && !reportGenerated) {
    return (
      <div className="card">
        <div className="card-body text-center py-5">
          <BarChart3 size={48} className="text-muted mb-3" />
          <h5>Monthly Net Control Report</h5>
          <p className="text-muted">Select a date range and click "Generate Report" to view the monthly net control activity report.</p>
        </div>
      </div>
    );
  }

  if (!report && reportGenerated) {
    return (
      <div className="alert alert-info">
        <p className="mb-0">No data found for the selected period. Please try a different date range.</p>
      </div>
    );
  }

  return (
    <div className="report-content">
      {/* Print Button */}
      <div className="mb-3 no-print">
        <button className="btn btn-success" onClick={onPrint}>
          <Download size={16} className="me-1" />
          Print/PDF
        </button>
      </div>

      {report && (
        <>
          {/* Report Header */}
          <div className="card mb-3">
            <div className="card-body text-center py-3">
              <h3 className="mb-1">Net Control Activity Report</h3>
              <p className="text-muted mb-0" style={{ fontSize: '0.9rem' }}>
                {formatDateLocal(report.period.start_date)} - {formatDateLocal(report.period.end_date)}
              </p>
            </div>
          </div>

          {/* Statistics Overview */}
          <div className="row mb-3 stats-overview-row">
            <div className="col-md-3">
              <div className="card">
                <div className="card-body text-center py-2">
                  <Users size={24} className="text-primary mb-1" />
                  <h4 className="mb-0">{report.statistics.total_sessions || 0}</h4>
                  <small className="text-muted">Total Sessions</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card">
                <div className="card-body text-center py-2">
                  <Award size={24} className="text-success mb-1" />
                  <h4 className="mb-0">{report.statistics.unique_controllers || 0}</h4>
                  <small className="text-muted">Net Controllers</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card">
                <div className="card-body text-center py-2">
                  <BarChart3 size={24} className="text-info mb-1" />
                  <h4 className="mb-0">{report.statistics.total_checkins || 0}</h4>
                  <small className="text-muted">Total Check-ins</small>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card">
                <div className="card-body text-center py-2">
                  <TrendingUp size={24} className="text-warning mb-1" />
                  <h4 className="mb-0">{report.statistics.avg_checkins_per_session || 0}</h4>
                  <small className="text-muted">Avg Check-ins/Session</small>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Controller Summary */}
          <div className="card mb-3">
            <div className="card-header">
              <h5 className="mb-0">1. Net Controller Summary</h5>
              <small className="text-muted">Total check-ins by net controller</small>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-striped table-hover table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Call Sign</th>
                      <th>Name</th>
                      <th className="text-center">Sessions</th>
                      <th className="text-center">Total Check-ins</th>
                      <th className="text-center">Avg/Session</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.controller_summary.map((controller, idx) => (
                      <tr key={idx}>
                        <td className="fw-bold">{controller.net_control_call}</td>
                        <td>{controller.net_control_name}</td>
                        <td className="text-center">{controller.sessions_count}</td>
                        <td className="text-center">{controller.total_checkins}</td>
                        <td className="text-center">
                          {controller.sessions_count > 0 
                            ? (controller.total_checkins / controller.sessions_count).toFixed(1)
                            : '0'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="table-secondary fw-bold">
                      <td colSpan="2">TOTAL</td>
                      <td className="text-center">{report.statistics.total_sessions}</td>
                      <td className="text-center">{report.statistics.total_checkins}</td>
                      <td className="text-center">{report.statistics.avg_checkins_per_session}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Section 2: Detailed Breakdown by Controller */}
          <div className="card mb-3">
            <div className="card-header">
              <h5 className="mb-0">2. Detailed Breakdown by Net Controller</h5>
              <small className="text-muted">Check-ins per session, grouped by controller</small>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Call Sign</th>
                      <th>Name</th>
                      <th>Date</th>
                      <th className="text-center">Check-ins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.controller_details.map((detail, idx) => {
                      const prevDetail = idx > 0 ? report.controller_details[idx - 1] : null;
                      const isNewController = !prevDetail || prevDetail.net_control_call !== detail.net_control_call;
                      const nextDetail = idx < report.controller_details.length - 1 ? report.controller_details[idx + 1] : null;
                      const isLastOfController = !nextDetail || nextDetail.net_control_call !== detail.net_control_call;
                      
                      // Calculate subtotal for this controller
                      let subtotal = 0;
                      if (isLastOfController) {
                        subtotal = report.controller_details
                          .filter(d => d.net_control_call === detail.net_control_call)
                          .reduce((sum, d) => sum + parseInt(d.checkins), 0);
                      }

                      return (
                        <React.Fragment key={idx}>
                          <tr className={isNewController ? 'table-active' : ''}>
                            <td className="fw-bold">{detail.net_control_call}</td>
                            <td>{detail.net_control_name}</td>
                            <td>{formatDateLocal(detail.session_date)}</td>
                            <td className="text-center">{detail.checkins}</td>
                          </tr>
                          {isLastOfController && (
                            <tr className="table-secondary">
                              <td colSpan="3" className="text-end fw-bold">
                                Subtotal for {detail.net_control_call}:
                              </td>
                              <td className="text-center fw-bold">{subtotal}</td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 3: Chronological List */}
          <div className="card mb-3">
            <div className="card-header">
              <h5 className="mb-0">3. Chronological Session List</h5>
              <small className="text-muted">All sessions ordered by date</small>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-striped table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Net Controller</th>
                      <th>Name</th>
                      <th className="text-center">Check-ins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.chronological_list.map((session, idx) => (
                      <tr key={idx}>
                        <td>{formatDateLocal(session.session_date)}</td>
                        <td className="fw-bold">{session.net_control_call}</td>
                        <td>{session.net_control_name}</td>
                        <td className="text-center">{session.checkins}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 4: Statistics */}
          <div className="card mb-3">
            <div className="card-header">
              <h5 className="mb-0">4. Period Statistics</h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <h6 className="text-muted mb-2">General Statistics</h6>
                  <table className="table table-sm mb-0">
                    <tbody>
                      <tr>
                        <td>Total Sessions:</td>
                        <td className="fw-bold">{report.statistics.total_sessions || 0}</td>
                      </tr>
                      <tr>
                        <td>Unique Net Controllers:</td>
                        <td className="fw-bold">{report.statistics.unique_controllers || 0}</td>
                      </tr>
                      <tr>
                        <td>Total Check-ins:</td>
                        <td className="fw-bold">{report.statistics.total_checkins || 0}</td>
                      </tr>
                      <tr>
                        <td>Average Check-ins per Session:</td>
                        <td className="fw-bold">{report.statistics.avg_checkins_per_session || 0}</td>
                      </tr>
                      <tr>
                        <td>Maximum Check-ins (Single Session):</td>
                        <td className="fw-bold">{report.statistics.max_checkins_session || 0}</td>
                      </tr>
                      <tr>
                        <td>Minimum Check-ins (Single Session):</td>
                        <td className="fw-bold">{report.statistics.min_checkins_session || 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="col-md-6">
                  <h6 className="text-muted mb-2">Best & Worst Sessions</h6>
                  {report.statistics.best_session && (
                    <div className="alert alert-success mb-2">
                      <strong>Best Session:</strong><br />
                      {formatDateLocal(report.statistics.best_session.session_date)}<br />
                      {report.statistics.best_session.net_control_call} - {report.statistics.best_session.net_control_name}<br />
                      <strong>{report.statistics.best_session.checkins} check-ins</strong>
                    </div>
                  )}
                  {report.statistics.worst_session && (
                    <div className="alert alert-warning mb-0">
                      <strong>Lowest Attendance:</strong><br />
                      {formatDateLocal(report.statistics.worst_session.session_date)}<br />
                      {report.statistics.worst_session.net_control_call} - {report.statistics.worst_session.net_control_name}<br />
                      <strong>{report.statistics.worst_session.checkins} check-ins</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Report Footer */}
          <div className="card">
            <div className="card-body text-center text-muted">
              <small>
                Report generated on {new Date().toLocaleString()}<br />
                NetControl Web Application
              </small>
            </div>
          </div>
        </>
      )}

      {!report && reportGenerated && !isLoading && (
        <div className="alert alert-info">
          <p className="mb-0">No data found for the selected period. Please try a different date range.</p>
        </div>
      )}

      <style jsx>{`
        @media print {
          /* Force hide no-print elements */
          .no-print,
          .row.no-print,
          div.no-print {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .no-print {
            display: none !important;
          }
          
          .report-content {
            font-size: 11pt;
            padding: 0 0.15in !important;
          }
          
          /* Fix the main reports row that wraps everything */
          .reports-main-row {
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          
          .reports-main-row .col-md-9 {
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          
          /* Hide all navigation and layout elements */
          .layout aside,
          .layout .sidebar,
          .layout .mobile-menu-toggle,
          .layout .mobile-overlay,
          aside.sidebar,
          .sidebar-header,
          .sidebar-footer,
          .user-menu,
          .nav-menu,
          nav,
          header,
          .navbar,
          button.mobile-menu-toggle {
            display: none !important;
          }
          
          /* Make main content full width */
          .layout {
            display: block !important;
          }
          
          .main-content,
          main.main-content {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          
          .container-fluid {
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* Hide the report type selector and date range filter */
          .col-md-3:first-child {
            display: none !important;
          }
          
          /* Make report content full width */
          .col-md-9 {
            flex: 0 0 100% !important;
            max-width: 100% !important;
          }
          
          .card {
            break-inside: avoid;
            page-break-inside: avoid;
            border: 1px solid #dee2e6 !important;
            box-shadow: none !important;
            margin-bottom: 1rem;
          }
          
          /* Force statistics row to display vertically in print */
          .stats-overview-row {
            display: block !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            margin-bottom: 0.5rem !important;
          }
          
          .stats-overview-row .col-md-3 {
            display: inline-block !important;
            width: 24% !important;
            max-width: 24% !important;
            min-width: 0 !important;
            padding: 0 !important;
            margin: 0 0.5% 0 0 !important;
            vertical-align: top !important;
          }
          
          .stats-overview-row .col-md-3:last-child {
            margin-right: 0 !important;
          }
          
          .stats-overview-row .card {
            margin: 0 !important;
            border: 1px solid #dee2e6 !important;
            width: 100% !important;
            display: block !important;
          }
          
          .stats-overview-row .card-body {
            padding: 0.25rem !important;
          }
          
          .stats-overview-row .card-body h4 {
            font-size: 12pt !important;
            margin: 0.1rem 0 !important;
          }
          
          .stats-overview-row .card-body small {
            font-size: 6.5pt !important;
          }
          
          /* Hide icons in stats overview to save space */
          .stats-overview-row .card-body svg {
            display: none !important;
          }
          
          /* General row styles for other rows */
          .row {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          
          .row .col-md-3 {
            padding-left: 0.15rem !important;
            padding-right: 0.15rem !important;
          }
          
          .row .col-md-4 {
            padding: 0 0.15rem !important;
          }
          
          .row .col-md-6 {
            padding: 0 0.15rem !important;
          }
          
          .row .card {
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          
          .row .card-body {
            padding: 0.4rem !important;
          }
          
          .row .card-body h4 {
            font-size: 14pt !important;
            margin: 0.2rem 0 !important;
          }
          
          .row .card-body small {
            font-size: 7pt !important;
          }
          
          /* Hide icons in print to save space */
          .row .card-body svg {
            display: none !important;
          }
          
          .card-header {
            background-color: #f8f9fa !important;
            border-bottom: 2px solid #dee2e6 !important;
            padding: 0.5rem 1rem !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .card-header h5 {
            font-size: 14pt;
            margin: 0;
          }
          
          .card-header small {
            font-size: 9pt;
          }
          
          .card-body {
            padding: 0.75rem !important;
          }
          
          .table {
            font-size: 9pt;
            margin-bottom: 0.5rem;
          }
          
          .table th {
            background-color: #f8f9fa !important;
            font-weight: 600;
            padding: 0.4rem !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .table td {
            padding: 0.3rem !important;
          }
          
          .table-secondary {
            background-color: #e9ecef !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .table-active {
            background-color: #f8f9fa !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .badge {
            border: 1px solid #dee2e6;
            padding: 0.2rem 0.4rem;
            font-size: 8pt;
          }
          
          .alert {
            padding: 0.5rem;
            margin-bottom: 0.5rem;
            font-size: 9pt;
            border: 1px solid;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .alert-success {
            background-color: #d1e7dd !important;
            border-color: #badbcc !important;
            color: #0f5132 !important;
          }
          
          .alert-warning {
            background-color: #fff3cd !important;
            border-color: #ffecb5 !important;
            color: #664d03 !important;
          }
          
          .row {
            margin-bottom: 0.5rem;
          }
          
          h3 {
            font-size: 16pt;
            margin-bottom: 0.5rem;
          }
          
          h4 {
            font-size: 14pt;
          }
          
          h5 {
            font-size: 12pt;
          }
          
          h6 {
            font-size: 10pt;
          }
          
          /* Statistics cards */
          .row .col-md-3 .card {
            margin-bottom: 0.5rem;
          }
          
          .row .col-md-3 .card-body {
            padding: 0.5rem !important;
          }
          
          .row .col-md-3 h4 {
            font-size: 18pt;
            margin: 0.25rem 0;
          }
          
          .row .col-md-3 small {
            font-size: 8pt;
          }
          
          /* Compact spacing */
          p {
            margin-bottom: 0.5rem;
          }
          
          /* Page breaks */
          .card:not(:first-child) {
            page-break-before: auto;
          }
          
          /* Ensure colors print */
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          /* Footer */
          .text-center.text-muted small {
            font-size: 8pt;
          }
        }
      `}</style>
    </div>
  );
};

// Other Reports Component
const OtherReports = ({ activeReport, reportTypes, data, isLoading, startDate, endDate, onPrint }) => {
  const currentReport = reportTypes.find(r => r.id === activeReport);
  
  if (isLoading) {
    return (
      <div className="card">
        <div className="card-body text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-muted">Loading report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <h5 className="mb-0">{currentReport?.name}</h5>
          <small className="text-muted">
            {formatDateLocal(startDate)} - {formatDateLocal(endDate)}
          </small>
        </div>
        <button className="btn btn-sm btn-outline-primary" onClick={onPrint}>
          <Printer size={16} className="me-1" />
          Print
        </button>
      </div>
      <div className="card-body">
        {activeReport === 'session-summary' && <SessionSummaryReport data={data} />}
        {activeReport === 'participant-stats' && <ParticipantStatsReport data={data} />}
        {activeReport === 'operator-activity' && <OperatorActivityReport data={data} />}
        {activeReport === 'geographic-distribution' && <GeographicDistributionReport data={data} />}
        {activeReport === 'traffic-report' && <TrafficReport data={data} />}
        {activeReport === 'net-controller-contacts' && <NetControllerContactsReport data={data} />}
        {activeReport === 'nc-statistics' && <NCStatisticsReport data={data} />}
      </div>
    </div>
  );
};

// Session Summary Report Component
const SessionSummaryReport = ({ data }) => {
  if (!data) {
    return (
      <div className="text-center py-5 text-muted">
        <Calendar size={48} className="mb-3 opacity-50" />
        <p>No session data available for the selected period.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary Stats */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center">
              <Calendar size={32} className="text-primary mb-2" />
              <h4 className="mb-0">{data.summary?.total_sessions || 0}</h4>
              <small className="text-muted">Total Sessions</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center">
              <Users size={32} className="text-success mb-2" />
              <h4 className="mb-0">{data.summary?.total_participants || 0}</h4>
              <small className="text-muted">Total Check-ins</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center">
              <TrendingUp size={32} className="text-info mb-2" />
              <h4 className="mb-0">{data.summary?.avg_participants || 0}</h4>
              <small className="text-muted">Avg per Session</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center">
              <MessageSquare size={32} className="text-warning mb-2" />
              <h4 className="mb-0">{data.summary?.total_traffic || 0}</h4>
              <small className="text-muted">Messages Handled</small>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="table-responsive">
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Date</th>
              <th>Net Control</th>
              <th>Frequency</th>
              <th className="text-center">Participants</th>
              <th className="text-center">Traffic</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {data.sessions?.map(session => (
              <tr key={session.id}>
                <td>{formatDateLocal(session.session_date)}</td>
                <td>
                  <strong>{session.net_control_call}</strong>
                  {session.net_control_name && (
                    <div className="small text-muted">{session.net_control_name}</div>
                  )}
                </td>
                <td>{session.frequency || 'N/A'}</td>
                <td className="text-center">
                  <span className="badge bg-primary">{session.participant_count}</span>
                </td>
                <td className="text-center">
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
  if (!data) {
    return (
      <div className="text-center py-5 text-muted">
        <Users size={48} className="mb-3 opacity-50" />
        <p>No participant data available for the selected period.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="row mb-4">
        <div className="col-md-6">
          <h5>Top Participants</h5>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Call Sign</th>
                  <th>Name</th>
                  <th className="text-center">Sessions</th>
                  <th>Participation Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.top_participants?.map((participant, index) => (
                  <tr key={participant.call_sign}>
                    <td>
                      <span className="badge bg-secondary">#{index + 1}</span>
                    </td>
                    <td><strong>{participant.call_sign}</strong></td>
                    <td>{participant.name || 'N/A'}</td>
                    <td className="text-center">
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
          <h5>Participation Trends</h5>
          <div className="card bg-light mb-3">
            <div className="card-body text-center">
              <h4 className="mb-0">{data.trends?.unique_participants || 0}</h4>
              <small className="text-muted">Unique Participants</small>
            </div>
          </div>
          <div className="card bg-light mb-3">
            <div className="card-body text-center">
              <h4 className="mb-0">{data.trends?.new_participants || 0}</h4>
              <small className="text-muted">New Participants</small>
            </div>
          </div>
          <div className="card bg-light">
            <div className="card-body text-center">
              <h4 className="mb-0">{data.trends?.returning_participants || 0}</h4>
              <small className="text-muted">Returning Participants</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Operator Activity Report Component
const OperatorActivityReport = ({ data }) => {
  if (!data) {
    return (
      <div className="text-center py-5 text-muted">
        <Radio size={48} className="mb-3 opacity-50" />
        <p>No operator activity data available for the selected period.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary Cards */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card bg-light">
            <div className="card-body text-center py-2">
              <h4 className="mb-0">{data.categories?.total_unique_operators || 0}</h4>
              <small className="text-muted">Total Unique Operators</small>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card bg-light">
            <div className="card-body text-center py-2">
              <h4 className="mb-0">{data.categories?.new_operators || 0}</h4>
              <small className="text-muted">New Operators</small>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card bg-light">
            <div className="card-body text-center py-2">
              <h4 className="mb-0">{data.categories?.returning_operators || 0}</h4>
              <small className="text-muted">Returning Operators</small>
            </div>
          </div>
        </div>
      </div>

      {/* Operator Statistics Table */}
      <div className="mb-4">
        <h5>Individual Operator Activity</h5>
        <div className="table-responsive">
          <table className="table table-striped table-sm">
            <thead>
              <tr>
                <th>Call Sign</th>
                <th>Name</th>
                <th className="text-center">Sessions</th>
                <th className="text-center">Participation %</th>
                <th>First Session</th>
                <th>Last Session</th>
                <th>Location(s)</th>
              </tr>
            </thead>
            <tbody>
              {data.operator_stats?.map((operator, idx) => (
                <tr key={idx}>
                  <td><strong>{operator.call_sign}</strong></td>
                  <td>{operator.name || 'N/A'}</td>
                  <td className="text-center">
                    <span className="badge bg-primary">{operator.total_sessions}</span>
                  </td>
                  <td className="text-center">
                    <div className="progress" style={{ height: '20px', minWidth: '60px' }}>
                      <div 
                        className="progress-bar" 
                        style={{ width: `${operator.participation_rate}%` }}
                      >
                        {operator.participation_rate}%
                      </div>
                    </div>
                  </td>
                  <td>{formatDateLocal(operator.first_session)}</td>
                  <td>{formatDateLocal(operator.last_session)}</td>
                  <td className="small">{operator.locations || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Consistency Metrics */}
      {data.consistency_metrics && data.consistency_metrics.length > 0 && (
        <div className="mb-4">
          <h5>Most Consistent Operators</h5>
          <p className="text-muted small">Operators who participated regularly throughout the period</p>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Call Sign</th>
                  <th className="text-center">Weeks Active</th>
                  <th className="text-center">Total Weeks</th>
                  <th>Consistency Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.consistency_metrics.map((metric, idx) => (
                  <tr key={idx}>
                    <td><span className="badge bg-secondary">#{idx + 1}</span></td>
                    <td><strong>{metric.call_sign}</strong></td>
                    <td className="text-center">{metric.weeks_active}</td>
                    <td className="text-center">{metric.total_weeks}</td>
                    <td>
                      <div className="progress" style={{ height: '20px' }}>
                        <div 
                          className="progress-bar bg-success" 
                          style={{ width: `${metric.consistency_rate}%` }}
                        >
                          {metric.consistency_rate}%
                        </div>
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

const GeographicDistributionReport = ({ data }) => {
  if (!data) {
    return (
      <div className="text-center py-5 text-muted">
        <MapPin size={48} className="mb-3 opacity-50" />
        <p>No geographic data available for the selected period.</p>
      </div>
    );
  }

  // Group operators by location for display
  const locationGroups = {};
  data.operators_by_location?.forEach(op => {
    if (!locationGroups[op.location]) {
      locationGroups[op.location] = [];
    }
    locationGroups[op.location].push(op);
  });

  return (
    <div>
      {/* Coverage Statistics */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center py-2">
              <MapPin size={24} className="text-primary mb-1" />
              <h4 className="mb-0">{data.coverage_stats?.unique_locations || 0}</h4>
              <small className="text-muted">Unique Locations</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center py-2">
              <Users size={24} className="text-success mb-1" />
              <h4 className="mb-0">{data.coverage_stats?.total_operators || 0}</h4>
              <small className="text-muted">Total Operators</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center py-2">
              <TrendingUp size={24} className="text-info mb-1" />
              <h4 className="mb-0">{data.coverage_stats?.location_coverage_rate || 0}%</h4>
              <small className="text-muted">Location Coverage</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center py-2">
              <AlertCircle size={24} className="text-warning mb-1" />
              <h4 className="mb-0">{data.coverage_stats?.operators_without_location || 0}</h4>
              <small className="text-muted">No Location Data</small>
            </div>
          </div>
        </div>
      </div>

      {/* Location Statistics */}
      <div className="row mb-4">
        <div className="col-md-6">
          <h5>Participation by Location</h5>
          <div className="table-responsive">
            <table className="table table-striped table-sm">
              <thead>
                <tr>
                  <th>Location</th>
                  <th className="text-center">Unique Operators</th>
                  <th className="text-center">Total Check-ins</th>
                </tr>
              </thead>
              <tbody>
                {data.location_stats?.map((location, idx) => (
                  <tr key={idx}>
                    <td>
                      <MapPin size={14} className="me-1" />
                      <strong>{location.location}</strong>
                    </td>
                    <td className="text-center">
                      <span className="badge bg-primary">{location.unique_operators}</span>
                    </td>
                    <td className="text-center">
                      <span className="badge bg-info">{location.total_checkins}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col-md-6">
          <h5>Session Geographic Diversity</h5>
          <p className="text-muted small">Number of unique locations per session</p>
          <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Net Control</th>
                  <th className="text-center">Locations</th>
                  <th className="text-center">Participants</th>
                </tr>
              </thead>
              <tbody>
                {data.session_diversity?.map((session, idx) => (
                  <tr key={idx}>
                    <td>{formatDateLocal(session.session_date)}</td>
                    <td className="small">{session.net_control_call}</td>
                    <td className="text-center">
                      <span className="badge bg-success">{session.unique_locations}</span>
                    </td>
                    <td className="text-center">
                      <span className="badge bg-primary">{session.total_participants}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Operators by Location */}
      <div className="mb-4">
        <h5>Operators by Location</h5>
        <div className="row">
          {Object.keys(locationGroups).sort().map((location, idx) => (
            <div key={idx} className="col-md-6 mb-3">
              <div className="card">
                <div className="card-header py-2">
                  <h6 className="mb-0">
                    <MapPin size={16} className="me-1" />
                    {location}
                  </h6>
                </div>
                <div className="card-body py-2">
                  <div className="d-flex flex-wrap gap-1">
                    {locationGroups[location].map((op, opIdx) => (
                      <span 
                        key={opIdx} 
                        className="badge bg-secondary"
                        title={`${op.call_sign} - ${op.checkin_count} check-ins`}
                      >
                        {op.call_sign} ({op.checkin_count})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TrafficReport = ({ data }) => {
  if (!data) {
    return (
      <div className="text-center py-5 text-muted">
        <MessageSquare size={48} className="mb-3 opacity-50" />
        <p>No traffic data available for the selected period.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Traffic Statistics */}
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center py-2">
              <MessageSquare size={24} className="text-primary mb-1" />
              <h4 className="mb-0">{data.traffic_stats?.total_messages || 0}</h4>
              <small className="text-muted">Total Messages</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center py-2">
              <Calendar size={24} className="text-success mb-1" />
              <h4 className="mb-0">{data.traffic_stats?.sessions_with_traffic || 0}</h4>
              <small className="text-muted">Sessions with Traffic</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center py-2">
              <TrendingUp size={24} className="text-info mb-1" />
              <h4 className="mb-0">{data.traffic_stats?.avg_messages_per_session || 0}</h4>
              <small className="text-muted">Avg Messages/Session</small>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-light">
            <div className="card-body text-center py-2">
              <Award size={24} className="text-warning mb-1" />
              <h4 className="mb-0">{data.traffic_stats?.max_messages_session || 0}</h4>
              <small className="text-muted">Max Messages (Session)</small>
            </div>
          </div>
        </div>
      </div>

      {/* Traffic by Priority/Type */}
      {data.traffic_by_type && data.traffic_by_type.length > 0 && (
        <div className="row mb-4">
          <div className="col-md-6">
            <h5>Messages by Priority</h5>
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th className="text-center">Count</th>
                    <th>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {data.traffic_by_type.map((type, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className={`badge ${
                          type.priority === 'Emergency' ? 'bg-danger' :
                          type.priority === 'Priority' ? 'bg-warning' :
                          type.priority === 'Welfare' ? 'bg-info' :
                          'bg-secondary'
                        }`}>
                          {type.priority}
                        </span>
                      </td>
                      <td className="text-center">{type.message_count}</td>
                      <td>
                        <div className="progress" style={{ height: '20px' }}>
                          <div 
                            className="progress-bar" 
                            style={{ width: `${type.percentage}%` }}
                          >
                            {type.percentage}%
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
            <h5>Traffic Activity</h5>
            <div className="card bg-light mb-2">
              <div className="card-body py-2">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="text-muted">Unique Originators:</span>
                  <strong>{data.traffic_stats?.unique_originators || 0}</strong>
                </div>
              </div>
            </div>
            <div className="card bg-light mb-2">
              <div className="card-body py-2">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="text-muted">Unique Recipients:</span>
                  <strong>{data.traffic_stats?.unique_recipients || 0}</strong>
                </div>
              </div>
            </div>
            <div className="card bg-light">
              <div className="card-body py-2">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="text-muted">Sessions with Traffic:</span>
                  <strong>
                    {data.traffic_stats?.sessions_with_traffic || 0} / {data.traffic_stats?.total_sessions || 0}
                    {data.traffic_stats?.total_sessions > 0 && (
                      <span className="text-muted ms-2">
                        ({Math.round((data.traffic_stats.sessions_with_traffic / data.traffic_stats.total_sessions) * 100)}%)
                      </span>
                    )}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Originators and Recipients */}
      <div className="row mb-4">
        <div className="col-md-6">
          <h5>Top Message Originators</h5>
          <div className="table-responsive">
            <table className="table table-striped table-sm">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Call Sign</th>
                  <th>Name</th>
                  <th className="text-center">Messages Sent</th>
                  <th className="text-center">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {data.top_originators?.map((originator, idx) => (
                  <tr key={idx}>
                    <td><span className="badge bg-secondary">#{idx + 1}</span></td>
                    <td><strong>{originator.from_call}</strong></td>
                    <td className="small">{originator.from_name || 'N/A'}</td>
                    <td className="text-center">
                      <span className="badge bg-primary">{originator.messages_sent}</span>
                    </td>
                    <td className="text-center">{originator.sessions_active}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col-md-6">
          <h5>Top Message Recipients</h5>
          <div className="table-responsive">
            <table className="table table-striped table-sm">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Call Sign</th>
                  <th>Name</th>
                  <th className="text-center">Messages Received</th>
                  <th className="text-center">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {data.top_recipients?.map((recipient, idx) => (
                  <tr key={idx}>
                    <td><span className="badge bg-secondary">#{idx + 1}</span></td>
                    <td><strong>{recipient.to_call}</strong></td>
                    <td className="small">{recipient.to_name || 'N/A'}</td>
                    <td className="text-center">
                      <span className="badge bg-success">{recipient.messages_received}</span>
                    </td>
                    <td className="text-center">{recipient.sessions_active}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Traffic by Session */}
      <div className="mb-4">
        <h5>Traffic by Session</h5>
        <div className="table-responsive">
          <table className="table table-striped table-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Net Control</th>
                <th className="text-center">Messages</th>
                <th className="text-center">Unique Senders</th>
                <th className="text-center">Unique Recipients</th>
              </tr>
            </thead>
            <tbody>
              {data.traffic_by_session?.map((session, idx) => (
                <tr key={idx}>
                  <td>{formatDateLocal(session.session_date)}</td>
                  <td>
                    <strong>{session.net_control_call}</strong>
                    {session.net_control_name && (
                      <div className="small text-muted">{session.net_control_name}</div>
                    )}
                  </td>
                  <td className="text-center">
                    <span className="badge bg-primary">{session.message_count}</span>
                  </td>
                  <td className="text-center">{session.unique_senders}</td>
                  <td className="text-center">{session.unique_recipients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Traffic Timeline */}
      {data.traffic_timeline && data.traffic_timeline.length > 0 && (
        <div className="mb-4">
          <h5>Traffic Timeline</h5>
          <p className="text-muted small">Daily message volume</p>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Messages</th>
                  <th>Volume</th>
                </tr>
              </thead>
              <tbody>
                {data.traffic_timeline.map((day, idx) => (
                  <tr key={idx}>
                    <td>{formatDateLocal(day.session_date)}</td>
                    <td><span className="badge bg-info">{day.message_count}</span></td>
                    <td>
                      <div className="progress" style={{ height: '20px' }}>
                        <div 
                          className="progress-bar bg-info" 
                          style={{ 
                            width: `${(day.message_count / Math.max(...data.traffic_timeline.map(d => d.message_count))) * 100}%` 
                          }}
                        >
                          {day.message_count > 0 && day.message_count}
                        </div>
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

const NetControllerContactsReport = ({ data }) => {
  if (!data) {
    return (
      <div className="text-center py-5 text-muted">
        <Award size={48} className="mb-3 opacity-50" />
        <p>No net controller contact data available.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary Card */}
      <div className="row mb-4">
        <div className="col-md-12">
          <div className="card bg-light">
            <div className="card-body text-center py-2">
              <Award size={32} className="text-primary mb-2" />
              <h4 className="mb-0">{data.total_count || 0}</h4>
              <small className="text-muted">Total Net Controllers</small>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Details Table */}
      <div className="mb-4">
        <h5>Net Controller Contact Information</h5>
        <p className="text-muted small">Contact details for all operators who have served as net controllers</p>
        <div className="table-responsive">
          <table className="table table-striped table-hover">
            <thead>
              <tr>
                <th>Call Sign</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone Number</th>
                <th className="text-center">Sessions Controlled</th>
              </tr>
            </thead>
            <tbody>
              {data.net_controllers?.map((controller, idx) => (
                <tr key={idx}>
                  <td>
                    <strong style={{ textTransform: 'uppercase' }}>
                      {controller.call_sign}
                    </strong>
                  </td>
                  <td>{controller.name || 'N/A'}</td>
                  <td>
                    {controller.email ? (
                      <a href={`mailto:${controller.email}`}>{controller.email}</a>
                    ) : (
                      <span className="text-muted">N/A</span>
                    )}
                  </td>
                  <td>{controller.phone_number || <span className="text-muted">N/A</span>}</td>
                  <td className="text-center">
                    <span className="badge bg-primary">{controller.sessions_controlled}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print-friendly note */}
      <div className="alert alert-info">
        <small>
          <strong>Note:</strong> This report includes contact information for all operators who have served as net controllers. 
          Use the Print button above to generate a PDF version of this contact list.
        </small>
      </div>
    </div>
  );
};

// NC Statistics Report Component
const NCStatisticsReport = ({ data }) => {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (!data) {
    return (
      <div className="text-center py-5 text-muted">
        <BarChart3 size={48} className="mb-3 opacity-50" />
        <p>No net controller statistics available.</p>
      </div>
    );
  }

  const { controllers, day_of_week, monthly_trend, totals, period } = data;

  // Build day-of-week map per controller
  const dowMap = {};
  (day_of_week || []).forEach(row => {
    if (!dowMap[row.net_control_call]) dowMap[row.net_control_call] = {};
    dowMap[row.net_control_call][row.dow] = parseInt(row.count);
  });

  return (
    <div>
      {/* Summary Cards */}
      <div className="d-flex flex-wrap gap-3 mb-4">
        <div className="card" style={{ minWidth: '140px', flex: 1 }}>
          <div className="card-body text-center p-3">
            <div className="h3 mb-0">{parseInt(totals?.total_sessions) || 0}</div>
            <small className="text-muted">Total Sessions</small>
          </div>
        </div>
        <div className="card" style={{ minWidth: '140px', flex: 1 }}>
          <div className="card-body text-center p-3">
            <div className="h3 mb-0">{parseInt(totals?.unique_controllers) || 0}</div>
            <small className="text-muted">Unique NCs</small>
          </div>
        </div>
        <div className="card" style={{ minWidth: '140px', flex: 1 }}>
          <div className="card-body text-center p-3">
            <div className="h3 mb-0">{parseInt(totals?.total_checkins) || 0}</div>
            <small className="text-muted">Total Check-ins</small>
          </div>
        </div>
        <div className="card" style={{ minWidth: '140px', flex: 1 }}>
          <div className="card-body text-center p-3">
            <div className="h3 mb-0">{parseInt(totals?.total_traffic) || 0}</div>
            <small className="text-muted">Total Traffic</small>
          </div>
        </div>
        <div className="card" style={{ minWidth: '140px', flex: 1 }}>
          <div className="card-body text-center p-3">
            <div className="h3 mb-0">{parseFloat(totals?.avg_checkins_per_session) || 0}</div>
            <small className="text-muted">Avg Check-ins/Session</small>
          </div>
        </div>
      </div>

      {/* Controller Leaderboard */}
      <div className="mb-4">
        <h5>Net Controller Leaderboard</h5>
        <div className="table-responsive">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>#</th>
                <th>Call Sign</th>
                <th>Name</th>
                <th>Sessions</th>
                <th>Check-ins</th>
                <th>Traffic</th>
                <th>Avg/Session</th>
                <th>Best Session</th>
                <th>First</th>
                <th>Last</th>
              </tr>
            </thead>
            <tbody>
              {(controllers || []).map((nc, idx) => (
                <tr key={nc.net_control_call}>
                  <td>{idx + 1}</td>
                  <td><strong>{nc.net_control_call}</strong></td>
                  <td>{nc.net_control_name || ''}</td>
                  <td><span className="badge bg-primary">{parseInt(nc.sessions_count)}</span></td>
                  <td>{parseInt(nc.total_checkins)}</td>
                  <td>{parseInt(nc.total_traffic)}</td>
                  <td>{parseFloat(nc.avg_checkins)}</td>
                  <td>{parseInt(nc.max_checkins)}</td>
                  <td className="small">{formatDateLocal(nc.first_session)}</td>
                  <td className="small">{formatDateLocal(nc.last_session)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Day of Week Breakdown */}
      {controllers && controllers.length > 0 && (
        <div className="mb-4">
          <h5>Sessions by Day of Week</h5>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Call Sign</th>
                  {dayNames.map(d => <th key={d} className="text-center">{d.slice(0, 3)}</th>)}
                  <th className="text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {controllers.map(nc => {
                  const ncDow = dowMap[nc.net_control_call] || {};
                  const total = Object.values(ncDow).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={nc.net_control_call}>
                      <td><strong>{nc.net_control_call}</strong></td>
                      {[0,1,2,3,4,5,6].map(d => (
                        <td key={d} className="text-center">{ncDow[d] || '-'}</td>
                      ))}
                      <td className="text-center"><strong>{total}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Trend */}
      {monthly_trend && monthly_trend.length > 0 && (
        <div className="mb-4">
          <h5>Monthly Trend</h5>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Sessions</th>
                  <th>Unique NCs</th>
                  <th>Total Check-ins</th>
                </tr>
              </thead>
              <tbody>
                {monthly_trend.map(row => (
                  <tr key={row.month}>
                    <td>{row.month}</td>
                    <td>{parseInt(row.sessions)}</td>
                    <td>{parseInt(row.unique_controllers)}</td>
                    <td>{parseInt(row.total_checkins)}</td>
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

export default Reports;
