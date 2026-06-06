import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, CheckCircle, AlertTriangle, Users, MessageSquare, Clock } from 'lucide-react';

const NetSummaryPopup = ({ show, onClose, sessionId, comparisonReport }) => {
  const navigate = useNavigate();

  if (!show || !comparisonReport) return null;

  const {
    match_percentage,
    primary_total_checkins,
    primary_total_traffic,
    alternate_total_checkins,
    alternate_total_traffic,
    total_discrepancies,
    summary
  } = comparisonReport;

  const matchColor = match_percentage >= 90 ? 'success' : match_percentage >= 70 ? 'warning' : 'danger';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h4 className="modal-title">
              <BarChart2 size={20} className="me-2" />
              Net Session Summary
            </h4>
            <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>×</button>
          </div>

          <div className="modal-body">
            {/* Match Percentage */}
            <div className="text-center mb-4">
              <h5 className="mb-2">Log Match</h5>
              <div className="d-flex align-items-center justify-content-center gap-3">
                <div className={`display-4 fw-bold text-${matchColor}`}>
                  {match_percentage}%
                </div>
                <div style={{ width: '200px' }}>
                  <div className="progress" style={{ height: '20px' }}>
                    <div
                      className={`progress-bar bg-${matchColor}`}
                      role="progressbar"
                      style={{ width: `${match_percentage}%` }}
                    />
                  </div>
                </div>
              </div>
              {match_percentage === 100 ? (
                <small className="text-success"><CheckCircle size={14} className="me-1" />Perfect match — both logs agree</small>
              ) : (
                <small className="text-muted"><AlertTriangle size={14} className="me-1" />{total_discrepancies} discrepancy{total_discrepancies !== 1 ? 'ies' : ''} found</small>
              )}
            </div>

            {/* Side by Side Totals */}
            <div className="row mb-4">
              <div className="col-md-6">
                <div className="card border-primary">
                  <div className="card-header bg-primary bg-opacity-10 py-2">
                    <strong>Primary Controller</strong>
                  </div>
                  <div className="card-body py-2">
                    <div className="d-flex justify-content-between mb-1">
                      <span><Users size={14} className="me-1" />Check-ins:</span>
                      <strong>{primary_total_checkins}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span><MessageSquare size={14} className="me-1" />Traffic:</span>
                      <strong>{primary_total_traffic}</strong>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card border-warning">
                  <div className="card-header bg-warning bg-opacity-10 py-2">
                    <strong>Alternate Controller</strong>
                  </div>
                  <div className="card-body py-2">
                    <div className="d-flex justify-content-between mb-1">
                      <span><Users size={14} className="me-1" />Check-ins:</span>
                      <strong>{alternate_total_checkins}</strong>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span><MessageSquare size={14} className="me-1" />Traffic:</span>
                      <strong>{alternate_total_traffic}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Discrepancy Summary */}
            {total_discrepancies > 0 && summary && (
              <div className="mb-3">
                <h6>Discrepancies</h6>
                <ul className="list-unstyled mb-0">
                  {summary.participant_discrepancies > 0 && (
                    <li className="mb-1">
                      <span className="badge bg-danger me-2">{summary.participant_discrepancies}</span>
                      Participant mismatch{summary.participant_discrepancies !== 1 ? 'es' : ''}
                    </li>
                  )}
                  {summary.checkin_time_discrepancies > 0 && (
                    <li className="mb-1">
                      <span className="badge bg-warning text-dark me-2">{summary.checkin_time_discrepancies}</span>
                      Check-in time difference{summary.checkin_time_discrepancies !== 1 ? 's' : ''}
                    </li>
                  )}
                  {summary.traffic_discrepancies > 0 && (
                    <li className="mb-1">
                      <span className="badge bg-danger me-2">{summary.traffic_discrepancies}</span>
                      Traffic mismatch{summary.traffic_discrepancies !== 1 ? 'es' : ''}
                    </li>
                  )}
                  {summary.traffic_detail_discrepancies > 0 && (
                    <li className="mb-1">
                      <span className="badge bg-info me-2">{summary.traffic_detail_discrepancies}</span>
                      Traffic detail difference{summary.traffic_detail_discrepancies !== 1 ? 's' : ''}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {summary?.scope === 'partial' && (
              <div className="alert alert-info py-2">
                <Clock size={14} className="me-1" />
                <small>Partial comparison — alternate controller joined mid-session</small>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              className="btn btn-primary"
              onClick={() => { onClose(); navigate(`/sessions/${sessionId}/comparison`); }}
            >
              View Full Report
            </button>
            <button className="btn btn-secondary" onClick={onClose}>
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetSummaryPopup;
