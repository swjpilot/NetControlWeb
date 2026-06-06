import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { BarChart2, ArrowLeft, Users, MessageSquare, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import axios from 'axios';

const ComparisonReport = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery(
    ['comparison-report', id],
    () => axios.get(`/api/alternate-controller/sessions/${id}/comparison`).then(r => r.data)
  );

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !data?.report) {
    return (
      <div className="container-fluid py-4">
        <button className="btn btn-outline-secondary mb-3" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} className="me-1" /> Back
        </button>
        <div className="alert alert-info">
          No comparison report found for this session.
        </div>
      </div>
    );
  }

  const report = data.report;
  const discrepancies = report.discrepancies || [];
  const summary = report.summary || {};
  const matchColor = report.match_percentage >= 90 ? 'success' : report.match_percentage >= 70 ? 'warning' : 'danger';

  const participantDisc = discrepancies.filter(d => d.category === 'participant');
  const checkinTimeDisc = discrepancies.filter(d => d.category === 'checkin_time');
  const trafficDisc = discrepancies.filter(d => d.category === 'traffic');
  const trafficDetailDisc = discrepancies.filter(d => d.category === 'traffic_detail');

  return (
    <div className="container-fluid py-4">
      <button className="btn btn-outline-secondary mb-3" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} className="me-1" /> Back
      </button>

      <h2 className="mb-4">
        <BarChart2 size={28} className="me-2" />
        Comparison Report — Session #{id}
      </h2>

      {/* Summary Header */}
      <div className="row mb-4">
        <div className="col-md-4">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title">Match</h5>
              <div className={`display-5 fw-bold text-${matchColor}`}>{report.match_percentage}%</div>
              <div className="progress mt-2" style={{ height: '8px' }}>
                <div className={`progress-bar bg-${matchColor}`} style={{ width: `${report.match_percentage}%` }} />
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title">Primary Log</h5>
              <div><Users size={14} className="me-1" />{report.primary_total_checkins} check-ins</div>
              <div><MessageSquare size={14} className="me-1" />{report.primary_total_traffic} traffic</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-center">
            <div className="card-body">
              <h5 className="card-title">Alternate Log</h5>
              <div><Users size={14} className="me-1" />{report.alternate_total_checkins} check-ins</div>
              <div><MessageSquare size={14} className="me-1" />{report.alternate_total_traffic} traffic</div>
            </div>
          </div>
        </div>
      </div>

      {summary.scope === 'partial' && (
        <div className="alert alert-info">
          <Clock size={14} className="me-1" />
          Partial comparison — alternate controller joined mid-session. Only data logged after the alternate joined is compared.
        </div>
      )}

      {discrepancies.length === 0 && (
        <div className="alert alert-success">
          <CheckCircle size={16} className="me-2" />
          Perfect match — no discrepancies found between the two logs.
        </div>
      )}

      {/* Participant Discrepancies */}
      {participantDisc.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">
              <Users size={16} className="me-2" />
              Participant Discrepancies ({participantDisc.length})
            </h5>
          </div>
          <div className="card-body p-0">
            <table className="table table-striped mb-0">
              <thead>
                <tr>
                  <th>Call Sign</th>
                  <th>Name</th>
                  <th>Issue</th>
                  <th>Primary</th>
                  <th>Alternate</th>
                </tr>
              </thead>
              <tbody>
                {participantDisc.map((d, i) => (
                  <tr key={i}>
                    <td><strong>{d.call_sign}</strong></td>
                    <td>{d.name || '-'}</td>
                    <td>
                      {d.type === 'missing_from_alternate' && (
                        <span className="badge bg-danger">Missing from alternate</span>
                      )}
                      {d.type === 'missing_from_primary' && (
                        <span className="badge bg-warning text-dark">Extra in alternate</span>
                      )}
                    </td>
                    <td>{d.primary_value || '—'}</td>
                    <td>{d.alternate_value || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Check-in Time Discrepancies */}
      {checkinTimeDisc.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">
              <Clock size={16} className="me-2" />
              Check-in Time Differences ({checkinTimeDisc.length})
            </h5>
          </div>
          <div className="card-body p-0">
            <table className="table table-striped mb-0">
              <thead>
                <tr>
                  <th>Call Sign</th>
                  <th>Name</th>
                  <th>Primary Time</th>
                  <th>Alternate Time</th>
                </tr>
              </thead>
              <tbody>
                {checkinTimeDisc.map((d, i) => (
                  <tr key={i}>
                    <td><strong>{d.call_sign}</strong></td>
                    <td>{d.name || '-'}</td>
                    <td>{d.primary_value}</td>
                    <td>{d.alternate_value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Traffic Discrepancies */}
      {trafficDisc.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">
              <MessageSquare size={16} className="me-2" />
              Traffic Discrepancies ({trafficDisc.length})
            </h5>
          </div>
          <div className="card-body p-0">
            <table className="table table-striped mb-0">
              <thead>
                <tr>
                  <th>From</th>
                  <th>Msg #</th>
                  <th>Issue</th>
                  <th>Primary</th>
                  <th>Alternate</th>
                </tr>
              </thead>
              <tbody>
                {trafficDisc.map((d, i) => (
                  <tr key={i}>
                    <td><strong>{d.from_call}</strong></td>
                    <td>{d.message_number || '-'}</td>
                    <td>
                      {d.type === 'missing_from_alternate' && (
                        <span className="badge bg-danger">Missing from alternate</span>
                      )}
                      {d.type === 'missing_from_primary' && (
                        <span className="badge bg-warning text-dark">Extra in alternate</span>
                      )}
                    </td>
                    <td>{d.primary_value || '—'}</td>
                    <td>{d.alternate_value || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Traffic Detail Discrepancies */}
      {trafficDetailDisc.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0">
              <AlertTriangle size={16} className="me-2" />
              Traffic Detail Differences ({trafficDetailDisc.length})
            </h5>
          </div>
          <div className="card-body p-0">
            <table className="table table-striped mb-0">
              <thead>
                <tr>
                  <th>From</th>
                  <th>Msg #</th>
                  <th>Field</th>
                  <th>Primary Value</th>
                  <th>Alternate Value</th>
                </tr>
              </thead>
              <tbody>
                {trafficDetailDisc.map((d, i) => (
                  <tr key={i}>
                    <td><strong>{d.from_call}</strong></td>
                    <td>{d.message_number || '-'}</td>
                    <td><code>{d.field}</code></td>
                    <td>{d.primary_value || '—'}</td>
                    <td>{d.alternate_value || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="card">
        <div className="card-body py-2">
          <small className="text-muted">
            <strong>Legend:</strong>{' '}
            <span className="badge bg-danger me-2">Missing from alternate</span>
            Logged by primary but not alternate{' | '}
            <span className="badge bg-warning text-dark me-2 ms-2">Extra in alternate</span>
            Logged by alternate but not primary
          </small>
        </div>
      </div>
    </div>
  );
};

export default ComparisonReport;
