const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const { authenticateToken, requireWrite } = require('./auth-postgres-js');

// Helper: Check if feature is enabled
async function checkFeatureEnabled() {
  const result = await db.sql`
    SELECT value FROM settings WHERE key = 'alternate_controller_enabled'
  `;
  return result.length > 0 && result[0].value === 'true';
}

// GET /api/alternate-controller/status - Check if feature is enabled
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const enabled = await checkFeatureEnabled();
    res.json({ enabled });
  } catch (error) {
    console.error('Check alternate controller status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/alternate-controller/sessions/:id/join - Join as alternate controller
router.post('/sessions/:id/join', authenticateToken, requireWrite, async (req, res) => {
  try {
    const { id } = req.params;

    // Check feature enabled
    const enabled = await checkFeatureEnabled();
    if (!enabled) {
      return res.status(403).json({ error: 'Alternate controller feature is disabled' });
    }

    // Verify session exists and is active (no end_time)
    const sessions = await db.sql`
      SELECT id, net_control_call, start_time, end_time 
      FROM sessions WHERE id = ${id}
    `;
    if (sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (sessions[0].end_time) {
      return res.status(400).json({ error: 'Session has already ended' });
    }

    // Get the requesting user's info
    const userResult = await db.sql`
      SELECT id, call_sign, name FROM users WHERE id = ${req.user.userId}
    `;
    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult[0];

    // Prevent primary controller from being alternate
    if (user.call_sign && user.call_sign.toUpperCase() === sessions[0].net_control_call?.toUpperCase()) {
      return res.status(400).json({ error: 'Primary controller cannot also be the alternate controller' });
    }

    // Check no existing active alternate for this session
    const existingAlt = await db.sql`
      SELECT id FROM alternate_session_logs 
      WHERE session_id = ${id} AND status = 'active'
    `;
    if (existingAlt.length > 0) {
      return res.status(409).json({ error: 'An alternate controller is already active on this session' });
    }

    // Create alternate session log
    const result = await db.sql`
      INSERT INTO alternate_session_logs (session_id, user_id, call_sign, name, join_time, status)
      VALUES (${id}, ${user.id}, ${user.call_sign || 'UNKNOWN'}, ${user.name}, CURRENT_TIMESTAMP, 'active')
      RETURNING *
    `;

    res.status(201).json({
      success: true,
      alternateLog: result[0]
    });
  } catch (error) {
    console.error('Join alternate controller error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// POST /api/alternate-controller/sessions/:id/leave - Leave as alternate controller
router.post('/sessions/:id/leave', authenticateToken, requireWrite, async (req, res) => {
  try {
    const { id } = req.params;

    // Find active alternate log for this user and session
    const altLog = await db.sql`
      SELECT id FROM alternate_session_logs 
      WHERE session_id = ${id} AND user_id = ${req.user.userId} AND status = 'active'
    `;
    if (altLog.length === 0) {
      return res.status(404).json({ error: 'No active alternate log found for this session' });
    }

    // Update status to departed
    const result = await db.sql`
      UPDATE alternate_session_logs 
      SET status = 'departed', leave_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${altLog[0].id}
      RETURNING *
    `;

    res.json({
      success: true,
      message: 'Left alternate controller role',
      alternateLog: result[0]
    });
  } catch (error) {
    console.error('Leave alternate controller error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// POST /api/alternate-controller/sessions/:id/participants - Add participant to alternate log
router.post('/sessions/:id/participants', authenticateToken, requireWrite, async (req, res) => {
  try {
    const { id } = req.params;
    const { call_sign, name, check_in_time, operator_id, notes } = req.body;

    if (!call_sign) {
      return res.status(400).json({ error: 'call_sign is required' });
    }

    // Verify caller has active alternate log
    const altLog = await db.sql`
      SELECT id FROM alternate_session_logs 
      WHERE session_id = ${id} AND user_id = ${req.user.userId} AND status = 'active'
    `;
    if (altLog.length === 0) {
      return res.status(403).json({ error: 'No active alternate log for this session' });
    }

    const result = await db.sql`
      INSERT INTO alternate_session_participants 
        (alternate_log_id, session_id, operator_id, call_sign, name, check_in_time, notes)
      VALUES 
        (${altLog[0].id}, ${id}, ${operator_id || null}, ${call_sign}, ${name || null}, ${check_in_time || null}, ${notes || null})
      RETURNING *
    `;

    res.status(201).json({
      success: true,
      participant: result[0]
    });
  } catch (error) {
    console.error('Add alternate participant error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// POST /api/alternate-controller/sessions/:id/traffic - Add traffic to alternate log
router.post('/sessions/:id/traffic', authenticateToken, requireWrite, async (req, res) => {
  try {
    const { id } = req.params;
    const { from_call, to_call, message_number, precedence, message_text, time_received, handled_by, notes } = req.body;

    if (!from_call || !to_call) {
      return res.status(400).json({ error: 'from_call and to_call are required' });
    }

    // Verify caller has active alternate log
    const altLog = await db.sql`
      SELECT id FROM alternate_session_logs 
      WHERE session_id = ${id} AND user_id = ${req.user.userId} AND status = 'active'
    `;
    if (altLog.length === 0) {
      return res.status(403).json({ error: 'No active alternate log for this session' });
    }

    const result = await db.sql`
      INSERT INTO alternate_session_traffic 
        (alternate_log_id, session_id, from_call, to_call, message_number, precedence, message_text, time_received, handled_by, notes)
      VALUES 
        (${altLog[0].id}, ${id}, ${from_call}, ${to_call}, ${message_number || null}, ${precedence || 'Routine'}, ${message_text || null}, ${time_received || null}, ${handled_by || null}, ${notes || null})
      RETURNING *
    `;

    res.status(201).json({
      success: true,
      traffic: result[0]
    });
  } catch (error) {
    console.error('Add alternate traffic error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/alternate-controller/sessions/:id/log - Get alternate log data
router.get('/sessions/:id/log', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get alternate log (any status) for this session
    const altLogs = await db.sql`
      SELECT * FROM alternate_session_logs 
      WHERE session_id = ${id}
      ORDER BY created_at DESC LIMIT 1
    `;
    if (altLogs.length === 0) {
      return res.status(404).json({ error: 'No alternate log found for this session' });
    }

    const altLog = altLogs[0];

    // Get participants
    const participants = await db.sql`
      SELECT * FROM alternate_session_participants 
      WHERE alternate_log_id = ${altLog.id}
      ORDER BY check_in_time, created_at
    `;

    // Get traffic
    const traffic = await db.sql`
      SELECT * FROM alternate_session_traffic 
      WHERE alternate_log_id = ${altLog.id}
      ORDER BY time_received, created_at
    `;

    // Get session metadata
    const sessions = await db.sql`
      SELECT session_date, net_control_call, net_control_name, frequency, mode, start_time, end_time
      FROM sessions WHERE id = ${id}
    `;

    res.json({
      alternateLog: altLog,
      participants,
      traffic,
      sessionMeta: sessions[0] || null
    });
  } catch (error) {
    console.error('Get alternate log error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// POST /api/alternate-controller/sessions/:id/comparison/generate - Generate comparison report
router.post('/sessions/:id/comparison/generate', authenticateToken, requireWrite, async (req, res) => {
  try {
    const { id } = req.params;
    const report = await generateComparisonReport(id);
    if (!report) {
      return res.status(404).json({ error: 'No alternate log found for this session' });
    }
    res.json({ success: true, report });
  } catch (error) {
    console.error('Generate comparison report error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/alternate-controller/sessions/:id/comparison - Get comparison report
router.get('/sessions/:id/comparison', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const reports = await db.sql`
      SELECT * FROM comparison_reports WHERE session_id = ${id} ORDER BY generated_at DESC LIMIT 1
    `;
    if (reports.length === 0) {
      return res.status(404).json({ error: 'No comparison report found for this session' });
    }

    res.json({ report: reports[0] });
  } catch (error) {
    console.error('Get comparison report error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Helper: Generate comparison report
async function generateComparisonReport(sessionId, altLogOverride) {
  // Get the alternate log
  let altLog = altLogOverride;
  if (!altLog) {
    const altLogs = await db.sql`
      SELECT * FROM alternate_session_logs 
      WHERE session_id = ${sessionId} AND status IN ('active', 'departed', 'completed')
      ORDER BY created_at DESC LIMIT 1
    `;
    if (altLogs.length === 0) return null;
    altLog = altLogs[0];
  }

  // Get primary participants
  let primaryParticipants = await db.sql`
    SELECT * FROM session_participants WHERE session_id = ${sessionId}
  `;

  // Get alternate participants
  const altParticipants = await db.sql`
    SELECT * FROM alternate_session_participants WHERE alternate_log_id = ${altLog.id}
  `;

  // Get primary traffic
  let primaryTraffic = await db.sql`
    SELECT * FROM session_traffic WHERE session_id = ${sessionId}
  `;

  // Get alternate traffic
  const altTraffic = await db.sql`
    SELECT * FROM alternate_session_traffic WHERE alternate_log_id = ${altLog.id}
  `;

  // Determine comparison scope (mid-session join handling)
  const session = (await db.sql`SELECT start_time FROM sessions WHERE id = ${sessionId}`)[0];
  let scopeStart = null;

  if (altLog.join_time && session && session.start_time) {
    const joinTime = new Date(altLog.join_time);
    // If alternate joined more than 2 minutes after session start, scope the comparison
    const sessionStartToday = new Date();
    const [h, m, s] = (session.start_time || '00:00:00').split(':');
    sessionStartToday.setHours(parseInt(h), parseInt(m), parseInt(s || 0), 0);
    
    if (joinTime - sessionStartToday > 2 * 60 * 1000) {
      scopeStart = altLog.join_time;
      // Filter primary data to only include entries after join time
      const joinTimeStr = joinTime.toTimeString().slice(0, 8);
      primaryParticipants = primaryParticipants.filter(p => 
        !p.check_in_time || p.check_in_time >= joinTimeStr
      );
      primaryTraffic = primaryTraffic.filter(t => 
        !t.time_received || t.time_received >= joinTimeStr
      );
    }
  }

  // Match participants by call sign
  const discrepancies = [];
  const primaryCallSigns = new Set(primaryParticipants.map(p => p.call_sign?.toUpperCase()));
  const altCallSigns = new Set(altParticipants.map(p => p.call_sign?.toUpperCase()));

  // Participants in primary but not alternate
  for (const p of primaryParticipants) {
    const cs = p.call_sign?.toUpperCase();
    if (!altCallSigns.has(cs)) {
      discrepancies.push({
        category: 'participant',
        type: 'missing_from_alternate',
        call_sign: p.call_sign,
        name: p.name,
        primary_value: p.check_in_time,
        alternate_value: null
      });
    }
  }

  // Participants in alternate but not primary
  for (const p of altParticipants) {
    const cs = p.call_sign?.toUpperCase();
    if (!primaryCallSigns.has(cs)) {
      discrepancies.push({
        category: 'participant',
        type: 'missing_from_primary',
        call_sign: p.call_sign,
        name: p.name,
        primary_value: null,
        alternate_value: p.check_in_time
      });
    }
  }

  // Check-in time differences for matched participants
  for (const pp of primaryParticipants) {
    const cs = pp.call_sign?.toUpperCase();
    const ap = altParticipants.find(a => a.call_sign?.toUpperCase() === cs);
    if (ap && pp.check_in_time && ap.check_in_time) {
      if (pp.check_in_time !== ap.check_in_time) {
        discrepancies.push({
          category: 'checkin_time',
          type: 'time_difference',
          call_sign: pp.call_sign,
          name: pp.name,
          primary_value: pp.check_in_time,
          alternate_value: ap.check_in_time
        });
      }
    }
  }

  // Match traffic by message_number + from_call
  const makeTrafficKey = (t) => `${(t.from_call || '').toUpperCase()}|${(t.message_number || '').toUpperCase()}`;
  const primaryTrafficKeys = new Map(primaryTraffic.map(t => [makeTrafficKey(t), t]));
  const altTrafficKeys = new Map(altTraffic.map(t => [makeTrafficKey(t), t]));

  // Traffic in primary but not alternate
  for (const [key, t] of primaryTrafficKeys) {
    if (!altTrafficKeys.has(key)) {
      discrepancies.push({
        category: 'traffic',
        type: 'missing_from_alternate',
        from_call: t.from_call,
        message_number: t.message_number,
        primary_value: `${t.from_call} → ${t.to_call}`,
        alternate_value: null
      });
    }
  }

  // Traffic in alternate but not primary
  for (const [key, t] of altTrafficKeys) {
    if (!primaryTrafficKeys.has(key)) {
      discrepancies.push({
        category: 'traffic',
        type: 'missing_from_primary',
        from_call: t.from_call,
        message_number: t.message_number,
        primary_value: null,
        alternate_value: `${t.from_call} → ${t.to_call}`
      });
    }
  }

  // Traffic detail differences for matched entries
  for (const [key, pt] of primaryTrafficKeys) {
    const at = altTrafficKeys.get(key);
    if (at) {
      const fields = ['precedence', 'message_text', 'handled_by', 'to_call'];
      for (const field of fields) {
        if ((pt[field] || '') !== (at[field] || '')) {
          discrepancies.push({
            category: 'traffic_detail',
            type: 'field_difference',
            from_call: pt.from_call,
            message_number: pt.message_number,
            field,
            primary_value: pt[field] || '',
            alternate_value: at[field] || ''
          });
        }
      }
    }
  }

  // Calculate match percentage
  const totalComparable = Math.max(
    primaryParticipants.length + primaryTraffic.length,
    altParticipants.length + altTraffic.length
  );
  
  let matchPercentage = 100.00;
  if (totalComparable > 0) {
    const participantMatches = primaryParticipants.filter(p => 
      altCallSigns.has(p.call_sign?.toUpperCase())
    ).length;
    const trafficMatches = [...primaryTrafficKeys.keys()].filter(k => altTrafficKeys.has(k)).length;
    const matchedItems = participantMatches + trafficMatches;
    matchPercentage = Math.round((matchedItems / totalComparable) * 10000) / 100;
  }

  // Build summary
  const summary = {
    scope: scopeStart ? 'partial' : 'full',
    scope_start: scopeStart,
    participant_discrepancies: discrepancies.filter(d => d.category === 'participant').length,
    checkin_time_discrepancies: discrepancies.filter(d => d.category === 'checkin_time').length,
    traffic_discrepancies: discrepancies.filter(d => d.category === 'traffic').length,
    traffic_detail_discrepancies: discrepancies.filter(d => d.category === 'traffic_detail').length
  };

  // Persist the report
  const report = await db.sql`
    INSERT INTO comparison_reports 
      (session_id, alternate_log_id, primary_total_checkins, primary_total_traffic, 
       alternate_total_checkins, alternate_total_traffic, match_percentage, 
       total_discrepancies, discrepancies, summary, comparison_scope_start)
    VALUES 
      (${sessionId}, ${altLog.id}, ${primaryParticipants.length}, ${primaryTraffic.length},
       ${altParticipants.length}, ${altTraffic.length}, ${matchPercentage},
       ${discrepancies.length}, ${JSON.stringify(discrepancies)}, ${JSON.stringify(summary)}, ${scopeStart})
    RETURNING *
  `;

  return report[0];
}

module.exports = router;
module.exports.generateComparisonReport = generateComparisonReport;
