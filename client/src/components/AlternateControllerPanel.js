import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Users, Plus, LogOut, Radio, Clock, MessageSquare } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AlternateControllerPanel = ({ sessionId, onLeave }) => {
  const queryClient = useQueryClient();
  const [callSign, setCallSign] = useState('');
  const [name, setName] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [trafficFrom, setTrafficFrom] = useState('');
  const [trafficTo, setTrafficTo] = useState('');
  const [trafficMsgNum, setTrafficMsgNum] = useState('');
  const [trafficPrecedence, setTrafficPrecedence] = useState('Routine');
  const [trafficMessage, setTrafficMessage] = useState('');
  const [trafficTime, setTrafficTime] = useState('');
  const [trafficHandledBy, setTrafficHandledBy] = useState('');

  // Fetch alternate log data
  const { data: logData, isLoading } = useQuery(
    ['alternate-log', sessionId],
    () => axios.get(`/api/alternate-controller/sessions/${sessionId}/log`).then(r => r.data),
    { refetchInterval: 10000 }
  );

  // Add participant mutation
  const addParticipantMutation = useMutation(
    (data) => axios.post(`/api/alternate-controller/sessions/${sessionId}/participants`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['alternate-log', sessionId]);
        setCallSign('');
        setName('');
        setCheckInTime('');
        toast.success('Participant logged');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to add participant');
      }
    }
  );

  // Add traffic mutation
  const addTrafficMutation = useMutation(
    (data) => axios.post(`/api/alternate-controller/sessions/${sessionId}/traffic`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['alternate-log', sessionId]);
        setTrafficFrom('');
        setTrafficTo('');
        setTrafficMsgNum('');
        setTrafficPrecedence('Routine');
        setTrafficMessage('');
        setTrafficTime('');
        setTrafficHandledBy('');
        toast.success('Traffic logged');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to add traffic');
      }
    }
  );

  // Leave session mutation
  const leaveMutation = useMutation(
    () => axios.post(`/api/alternate-controller/sessions/${sessionId}/leave`),
    {
      onSuccess: () => {
        toast.success('Left alternate controller role');
        if (onLeave) onLeave();
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to leave session');
      }
    }
  );

  const handleAddParticipant = (e) => {
    e.preventDefault();
    if (!callSign.trim()) return;
    addParticipantMutation.mutate({
      call_sign: callSign.toUpperCase().trim(),
      name: name.trim() || null,
      check_in_time: checkInTime || null
    });
  };

  const handleAddTraffic = (e) => {
    e.preventDefault();
    if (!trafficFrom.trim() || !trafficTo.trim()) return;
    addTrafficMutation.mutate({
      from_call: trafficFrom.toUpperCase().trim(),
      to_call: trafficTo.toUpperCase().trim(),
      message_number: trafficMsgNum.trim() || null,
      precedence: trafficPrecedence,
      message_text: trafficMessage.trim() || null,
      time_received: trafficTime || null,
      handled_by: trafficHandledBy.toUpperCase().trim() || null
    });
  };

  if (isLoading) {
    return (
      <div className="card mb-3">
        <div className="card-body text-center">
          <div className="spinner-border spinner-border-sm" role="status" />
          <span className="ms-2">Loading alternate log...</span>
        </div>
      </div>
    );
  }

  const participants = logData?.participants || [];
  const traffic = logData?.traffic || [];
  const sessionMeta = logData?.sessionMeta;

  return (
    <div className="card mb-3 border-warning">
      <div className="card-header bg-warning bg-opacity-10 d-flex justify-content-between align-items-center">
        <div>
          <Users size={18} className="me-2" />
          <strong>Alternate Controller Log</strong>
          <span className="badge bg-warning text-dark ms-2">Verification Mode</span>
        </div>
        <button className="btn btn-sm btn-outline-danger" onClick={() => leaveMutation.mutate()}>
          <LogOut size={14} className="me-1" />
          Leave Session
        </button>
      </div>

      {/* Session metadata (read-only) */}
      {sessionMeta && (
        <div className="card-body py-2 bg-light border-bottom">
          <small className="text-muted">
            <Radio size={12} className="me-1" />
            {sessionMeta.frequency} {sessionMeta.mode} | 
            Net Control: {sessionMeta.net_control_call} | 
            Started: {sessionMeta.start_time}
          </small>
        </div>
      )}

      <div className="card-body">
        {/* Add Participant Form */}
        <h6><Plus size={14} className="me-1" />Log Participant</h6>
        <form onSubmit={handleAddParticipant} className="row g-2 mb-3">
          <div className="col-md-3">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Call Sign *"
              value={callSign}
              onChange={(e) => setCallSign(e.target.value.toUpperCase())}
              required
            />
          </div>
          <div className="col-md-3">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <input
              type="time"
              className="form-control form-control-sm"
              value={checkInTime}
              onChange={(e) => setCheckInTime(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <button type="submit" className="btn btn-sm btn-primary w-100" disabled={addParticipantMutation.isLoading}>
              <Plus size={14} /> Add
            </button>
          </div>
        </form>

        {/* Participants Table */}
        {participants.length > 0 && (
          <div className="mb-3">
            <small className="text-muted fw-bold">
              <Clock size={12} className="me-1" />
              Participants ({participants.length})
            </small>
            <table className="table table-sm table-striped mt-1">
              <thead>
                <tr><th>Call Sign</th><th>Name</th><th>Check-in</th></tr>
              </thead>
              <tbody>
                {participants.map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.call_sign}</strong></td>
                    <td>{p.name || '-'}</td>
                    <td>{p.check_in_time || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Traffic Form */}
        <h6><MessageSquare size={14} className="me-1" />Log Traffic</h6>
        <form onSubmit={handleAddTraffic} className="row g-2 mb-3">
          <div className="col-md-2">
            <input type="text" className="form-control form-control-sm" placeholder="From *"
              value={trafficFrom} onChange={(e) => setTrafficFrom(e.target.value.toUpperCase())} required />
          </div>
          <div className="col-md-2">
            <input type="text" className="form-control form-control-sm" placeholder="To *"
              value={trafficTo} onChange={(e) => setTrafficTo(e.target.value.toUpperCase())} required />
          </div>
          <div className="col-md-2">
            <input type="text" className="form-control form-control-sm" placeholder="Msg #"
              value={trafficMsgNum} onChange={(e) => setTrafficMsgNum(e.target.value)} />
          </div>
          <div className="col-md-2">
            <select className="form-select form-select-sm" value={trafficPrecedence}
              onChange={(e) => setTrafficPrecedence(e.target.value)}>
              <option value="Routine">Routine</option>
              <option value="Priority">Priority</option>
              <option value="Welfare">Welfare</option>
              <option value="Emergency">Emergency</option>
            </select>
          </div>
          <div className="col-md-2">
            <input type="time" className="form-control form-control-sm"
              value={trafficTime} onChange={(e) => setTrafficTime(e.target.value)} />
          </div>
          <div className="col-md-2">
            <button type="submit" className="btn btn-sm btn-primary w-100" disabled={addTrafficMutation.isLoading}>
              <Plus size={14} /> Add
            </button>
          </div>
        </form>

        {/* Traffic Table */}
        {traffic.length > 0 && (
          <div>
            <small className="text-muted fw-bold">
              <MessageSquare size={12} className="me-1" />
              Traffic ({traffic.length})
            </small>
            <table className="table table-sm table-striped mt-1">
              <thead>
                <tr><th>From</th><th>To</th><th>Msg #</th><th>Precedence</th><th>Time</th></tr>
              </thead>
              <tbody>
                {traffic.map(t => (
                  <tr key={t.id}>
                    <td>{t.from_call}</td>
                    <td>{t.to_call}</td>
                    <td>{t.message_number || '-'}</td>
                    <td>{t.precedence}</td>
                    <td>{t.time_received || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlternateControllerPanel;
