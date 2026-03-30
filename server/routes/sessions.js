const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const { authenticateToken, requireWrite } = require('./auth-postgres-js');

// Debug endpoint to list all session IDs
router.get('/debug/list-ids', authenticateToken, async (req, res) => {
  try {
    const sessions = await db.sql`SELECT id, session_date, net_control_call FROM sessions ORDER BY id`;
    res.json({
      debug: {
        total_sessions: sessions.length,
        session_ids: sessions.map(s => ({ id: s.id, date: s.session_date, call: s.net_control_call }))
      }
    });
  } catch (error) {
    console.error('Debug list IDs error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to create a test session
router.post('/debug/create-test', authenticateToken, async (req, res) => {
  try {
    const testSession = await db.sql`
      INSERT INTO sessions (session_date, net_control_call, net_control_name, frequency, mode, net_type, notes)
      VALUES (CURRENT_DATE, 'W1TEST', 'Test Operator', '146.520 MHz', 'FM', 'Regular', 'Test session created by debug endpoint')
      RETURNING *
    `;
    
    res.json({
      success: true,
      session: testSession[0]
    });
  } catch (error) {
    console.error('Create test session error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to check database contents
router.get('/debug', authenticateToken, async (req, res) => {
  try {
    const sessionCount = await db.sql`SELECT COUNT(*) as count FROM sessions`;
    const participantCount = await db.sql`SELECT COUNT(*) as count FROM session_participants`;
    const trafficCount = await db.sql`SELECT COUNT(*) as count FROM session_traffic`;
    
    const sampleSessions = await db.sql`SELECT * FROM sessions LIMIT 3`;
    
    res.json({
      debug: {
        session_count: parseInt(sessionCount[0].count),
        participant_count: parseInt(participantCount[0].count),
        traffic_count: parseInt(trafficCount[0].count),
        sample_sessions: sampleSessions
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all sessions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 25, offset = 0, search, date_from, date_to } = req.query;
    
    // Build filter conditions using postgres.js unsafe for dynamic WHERE
    let filterSQL = '';
    const params = [];
    
    if (search || date_from || date_to) {
      const clauses = [];
      if (search) {
        clauses.push(`(s.net_control_call ILIKE $${params.length + 1} OR s.net_control_name ILIKE $${params.length + 1} OR s.frequency ILIKE $${params.length + 1} OR s.notes ILIKE $${params.length + 1})`);
        params.push(`%${search}%`);
      }
      if (date_from) {
        clauses.push(`s.session_date >= $${params.length + 1}`);
        params.push(date_from);
      }
      if (date_to) {
        clauses.push(`s.session_date <= $${params.length + 1}`);
        params.push(date_to);
      }
      filterSQL = 'WHERE ' + clauses.join(' AND ');
    }

    const countResult = await db.sql.unsafe(
      `SELECT COUNT(DISTINCT s.id) as count FROM sessions s ${filterSQL}`,
      params
    );
    const total = parseInt(countResult[0].count);
    
    const sessions = await db.sql.unsafe(
      `SELECT s.id, s.session_date, s.net_control_call, s.net_control_name, 
             s.start_time, s.end_time, s.frequency, s.mode, s.notes,
             s.total_checkins, s.total_traffic,
             s.created_at, s.updated_at
      FROM sessions s
      ${filterSQL}
      ORDER BY s.session_date DESC, s.start_time DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    
    // Calculate actual counts for each session
    const sessionsWithCounts = [];
    for (const session of sessions) {
      // Get participant count
      const participantResult = await db.sql`
        SELECT COUNT(*) as count FROM session_participants WHERE session_id = ${session.id}
      `;
      const actual_participants = parseInt(participantResult[0].count) || 0;
      
      // Get traffic count
      const trafficResult = await db.sql`
        SELECT COUNT(*) as count FROM session_traffic WHERE session_id = ${session.id}
      `;
      const actual_traffic = parseInt(trafficResult[0].count) || 0;
      
      // Use actual count if there are real records, otherwise fall back to stored summary totals
      const participant_count = actual_participants > 0 ? actual_participants : (parseInt(session.total_checkins) || 0);
      const traffic_count = actual_traffic > 0 ? actual_traffic : (parseInt(session.total_traffic) || 0);
      
      sessionsWithCounts.push({
        ...session,
        participant_count,
        traffic_count,
        weather: session.weather || session.weather_report || null,
        net_type: session.net_type || 'Regular',
        power: session.power || null,
        antenna: session.antenna || null
      });
    }
    
    res.json({
      sessions: sessionsWithCounts,
      total,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
    
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get session statistics summary for dashboard
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const result = await db.sql`
      SELECT 
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(DISTINCT CASE WHEN s.session_date >= CURRENT_DATE - INTERVAL '7 days' THEN s.id END) as sessions_last_7_days,
        SUM(GREATEST(COALESCE(pc.count, 0), COALESCE(s.total_checkins, 0))) as total_participants,
        SUM(GREATEST(COALESCE(tc.count, 0), COALESCE(s.total_traffic, 0))) as total_traffic_handled
      FROM sessions s
      LEFT JOIN (
        SELECT session_id, COUNT(*) as count
        FROM session_participants
        GROUP BY session_id
      ) pc ON s.id = pc.session_id
      LEFT JOIN (
        SELECT session_id, COUNT(*) as count
        FROM session_traffic
        GROUP BY session_id
      ) tc ON s.id = tc.session_id
    `;
    
    const stats = result[0];
    
    res.json({
      stats: {
        total_sessions: parseInt(stats.total_sessions) || 0,
        sessions_last_7_days: parseInt(stats.sessions_last_7_days) || 0,
        total_participants: parseInt(stats.total_participants) || 0,
        total_traffic_handled: parseInt(stats.total_traffic_handled) || 0
      }
    });
    
  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single session with participants and traffic
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('=== SESSION DETAIL DEBUG ===');
    console.log('Raw ID from params:', id);
    console.log('ID type:', typeof id);
    console.log('Parsed ID:', parseInt(id));
    console.log('Is valid number:', !isNaN(parseInt(id)));
    
    // Validate that ID is a number
    if (!id || isNaN(parseInt(id))) {
      console.log('❌ Invalid session ID:', id);
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    
    const sessionId = parseInt(id);
    console.log('Using session ID:', sessionId);
    
    // Get basic session details
    const sessionResult = await db.sql`
      SELECT id, session_date, net_control_call, net_control_name, start_time, end_time,
             frequency, mode, notes, weather, net_type, power, antenna,
             total_checkins, total_traffic,
             created_at, updated_at
      FROM sessions 
      WHERE id = ${sessionId}
    `;
    
    console.log('Session query executed for ID:', sessionId);
    console.log('Query result count:', sessionResult.length);
    
    if (sessionResult.length === 0) {
      console.log('❌ Session not found for ID:', sessionId);
      
      // Let's also check what sessions DO exist
      const allSessions = await db.sql`SELECT id, net_control_call FROM sessions LIMIT 5`;
      console.log('Available sessions:', allSessions.map(s => ({ id: s.id, call: s.net_control_call })));
      
      return res.status(404).json({ 
        error: 'Session not found',
        requestedId: sessionId,
        availableSessions: allSessions.map(s => s.id)
      });
    }
    
    const session = sessionResult[0];
    console.log('✅ Found session:', session.id, session.net_control_call);
    
    // Get participants with operator information
    const participants = await db.sql`
      SELECT sp.id, sp.call_sign, sp.name, sp.check_in_time, sp.check_out_time, sp.notes, 
             sp.created_at, sp.updated_at, sp.operator_id,
             COALESCE(sp.flag_comment, false) as flag_comment,
             COALESCE(sp.flag_traffic, false) as flag_traffic,
             COALESCE(sp.flag_echolink, false) as flag_echolink,
             COALESCE(sp.flag_announcement, false) as flag_announcement,
             COALESCE(sp.acknowledged, false) as acknowledged,
             o.name as operator_name, 
             o.preferred_name as operator_preferred_name,
             o.city as operator_city,
             o.state as operator_state,
             o.license_class,
             COALESCE(sp.name, o.name) as display_name,
             CASE 
               WHEN o.city IS NOT NULL AND o.state IS NOT NULL THEN o.city || ', ' || o.state
               WHEN o.city IS NOT NULL THEN o.city
               WHEN o.state IS NOT NULL THEN o.state
               ELSE ''
             END as display_location
      FROM session_participants sp
      LEFT JOIN operators o ON sp.operator_id = o.id
      WHERE sp.session_id = ${sessionId}
      ORDER BY sp.check_in_time ASC, sp.call_sign ASC
    `;
    
    // Get traffic
    const traffic = await db.sql`
      SELECT id, from_call, to_call, message_number, precedence, message_text, 
             time_received, handled_by, notes, created_at, updated_at
      FROM session_traffic 
      WHERE session_id = ${sessionId}
      ORDER BY time_received ASC, created_at ASC
    `;
    
    // Add counts - use actual records if present, otherwise fall back to stored summary totals
    const participant_count = participants.length > 0 ? participants.length : (parseInt(session.total_checkins) || 0);
    const traffic_count = traffic.length > 0 ? traffic.length : (parseInt(session.total_traffic) || 0);
    
    console.log('✅ Session details prepared:', {
      sessionId: session.id,
      participantCount: participant_count,
      trafficCount: traffic_count
    });
    console.log('=== END SESSION DETAIL DEBUG ===');
    
    res.json({
      session: {
        ...session,
        participant_count,
        traffic_count,
        participants,
        traffic
      }
    });
    
  } catch (error) {
    console.error('❌ Get session error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Create new session
router.post('/', authenticateToken, requireWrite, async (req, res) => {
  try {
    const {
      session_date,
      net_control_call,
      net_control_name,
      start_time,
      end_time,
      frequency,
      mode,
      notes,
      weather_report,
      total_checkins = 0,
      total_traffic = 0
    } = req.body;
    
    if (!session_date || !net_control_call) {
      return res.status(400).json({ error: 'Session date and net control call sign are required' });
    }
    
    const result = await db.sql`
      INSERT INTO sessions (
        session_date, net_control_call, net_control_name, start_time, end_time,
        frequency, mode, notes, weather_report, total_checkins, total_traffic
      ) VALUES (
        ${session_date}, ${net_control_call.toUpperCase()}, ${net_control_name || null}, 
        ${start_time || null}, ${end_time || null}, ${frequency || null}, 
        ${mode || 'FM'}, ${notes || null}, ${weather_report || null},
        ${total_checkins}, ${total_traffic}
      ) RETURNING *
    `;
    
    res.status(201).json(result[0]);
    
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update session
router.put('/:id', authenticateToken, requireWrite, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      session_date,
      net_control_call,
      net_control_name,
      start_time,
      end_time,
      frequency,
      mode,
      notes,
      weather_report,
      total_checkins,
      total_traffic
    } = req.body;
    
    if (!session_date || !net_control_call) {
      return res.status(400).json({ error: 'Session date and net control call sign are required' });
    }
    
    const result = await db.sql`
      UPDATE sessions SET
        session_date = ${session_date},
        net_control_call = ${net_control_call.toUpperCase()},
        net_control_name = ${net_control_name || null},
        start_time = ${start_time || null},
        end_time = ${end_time || null},
        frequency = ${frequency || null},
        mode = ${mode || 'FM'},
        notes = ${notes || null},
        weather_report = ${weather_report || null},
        total_checkins = ${total_checkins || 0},
        total_traffic = ${total_traffic || 0},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json(result[0]);
    
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete session
router.delete('/:id', authenticateToken, requireWrite, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch the session first to check permissions
    const session = await db.sql`
      SELECT id, net_control_call, created_at FROM sessions WHERE id = ${id}
    `;
    
    if (session.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const isAdmin = req.user.role === 'admin';
    const userCallSign = (req.user.callSign || '').toUpperCase();
    const sessionCallSign = (session[0].net_control_call || '').toUpperCase();
    const isOwner = userCallSign && userCallSign === sessionCallSign;
    const hoursOld = (Date.now() - new Date(session[0].created_at).getTime()) / (1000 * 60 * 60);
    
    if (!isAdmin) {
      if (!isOwner) {
        return res.status(403).json({ error: 'Only the net controller who created this session or an admin can delete it' });
      }
      if (hoursOld > 72) {
        return res.status(403).json({ error: 'Sessions can only be deleted within 72 hours of creation. Contact an admin.' });
      }
    }
    
    await db.sql`DELETE FROM sessions WHERE id = ${id}`;
    
    res.json({ message: 'Session deleted successfully' });
    
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add participant to session
router.post('/:id/participants', authenticateToken, requireWrite, async (req, res) => {
  try {
    const { id } = req.params;
    const { call_sign, name, check_in_time, check_out_time, notes, operator_id, flag_comment, flag_traffic, flag_echolink, flag_announcement } = req.body;
    
    if (!call_sign) {
      return res.status(400).json({ error: 'Call sign is required' });
    }
    
    // Check if session exists
    const sessionCheck = await db.sql`
      SELECT id FROM sessions WHERE id = ${id}
    `;
    
    if (sessionCheck.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if participant already exists in this session
    const existingParticipant = await db.sql`
      SELECT id FROM session_participants 
      WHERE session_id = ${id} AND call_sign = ${call_sign.toUpperCase()}
    `;
    
    if (existingParticipant.length > 0) {
      return res.status(400).json({ error: 'Participant already exists in this session' });
    }
    
    let finalOperatorId = operator_id;
    let operatorCreated = false;
    
    // If no operator_id provided, try to find or create operator
    if (!finalOperatorId) {
      // First, try to find existing operator by call sign
      const existingOperator = await db.sql`
        SELECT id FROM operators WHERE call_sign = ${call_sign.toUpperCase()}
      `;
      
      if (existingOperator.length > 0) {
        finalOperatorId = existingOperator[0].id;
        console.log(`Found existing operator for ${call_sign}: ID ${finalOperatorId}`);
      } else if (name) {
        // Create new operator if we have a name
        try {
          const newOperator = await db.sql`
            INSERT INTO operators (call_sign, name, active)
            VALUES (${call_sign.toUpperCase()}, ${name}, true)
            RETURNING id
          `;
          finalOperatorId = newOperator[0].id;
          operatorCreated = true;
          console.log(`Created new operator for ${call_sign}: ID ${finalOperatorId}`);
        } catch (operatorError) {
          console.error('Error creating operator:', operatorError);
          // Continue without operator_id if creation fails
        }
      }
    }
    
    const result = await db.sql`
      INSERT INTO session_participants (
        session_id, call_sign, name, check_in_time, check_out_time, notes, operator_id,
        flag_comment, flag_traffic, flag_echolink, flag_announcement
      ) VALUES (
        ${id}, ${call_sign.toUpperCase()}, ${name || null}, 
        ${check_in_time || null}, ${check_out_time || null}, ${notes || null}, ${finalOperatorId || null},
        ${flag_comment || false}, ${flag_traffic || false}, ${flag_echolink || false}, ${flag_announcement || false}
      ) RETURNING *
    `;
    
    // Update session participant count
    await db.sql`
      UPDATE sessions 
      SET total_checkins = (
        SELECT COUNT(*) FROM session_participants WHERE session_id = ${id}
      ),
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;
    
    res.status(201).json({
      ...result[0],
      operator_created: operatorCreated
    });
    
  } catch (error) {
    console.error('Add participant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update participant
router.put('/:sessionId/participants/:participantId', authenticateToken, async (req, res) => {
  try {
    const { sessionId, participantId } = req.params;
    const { call_sign, name, check_in_time, check_out_time, notes, operator_id, flag_comment, flag_traffic, flag_echolink, flag_announcement, acknowledged } = req.body;
    
    if (!call_sign) {
      return res.status(400).json({ error: 'Call sign is required' });
    }
    
    // Check if participant exists in this session
    const existingParticipant = await db.sql`
      SELECT id FROM session_participants 
      WHERE id = ${participantId} AND session_id = ${sessionId}
    `;
    
    if (existingParticipant.length === 0) {
      return res.status(404).json({ error: 'Participant not found in this session' });
    }
    
    const result = await db.sql`
      UPDATE session_participants SET
        call_sign = ${call_sign.toUpperCase()},
        name = ${name || null},
        check_in_time = ${check_in_time || null},
        check_out_time = ${check_out_time || null},
        notes = ${notes || null},
        operator_id = ${operator_id || null},
        flag_comment = ${flag_comment || false},
        flag_traffic = ${flag_traffic || false},
        flag_echolink = ${flag_echolink || false},
        flag_announcement = ${flag_announcement || false},
        acknowledged = ${acknowledged !== undefined ? acknowledged : false},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${participantId} AND session_id = ${sessionId}
      RETURNING *
    `;
    
    res.json(result[0]);
    
  } catch (error) {
    console.error('Update participant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Patch participant (lightweight update for acknowledged, preferred_name)
router.patch('/:sessionId/participants/:participantId', authenticateToken, async (req, res) => {
  try {
    const { sessionId, participantId } = req.params;
    const { acknowledged, preferred_name } = req.body;

    // Verify participant exists
    const existing = await db.sql`
      SELECT sp.*, sp.operator_id FROM session_participants sp
      WHERE sp.id = ${participantId} AND sp.session_id = ${sessionId}
    `;
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    // Update acknowledged if provided
    if (acknowledged !== undefined) {
      await db.sql`
        UPDATE session_participants SET acknowledged = ${acknowledged}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${participantId} AND session_id = ${sessionId}
      `;
    }

    // Update preferred_name on the operator record if provided
    if (preferred_name !== undefined && existing[0].operator_id) {
      await db.sql`
        UPDATE operators SET preferred_name = ${preferred_name || null}
        WHERE id = ${existing[0].operator_id}
      `;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Patch participant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove participant from session
router.delete('/:sessionId/participants/:participantId', authenticateToken, async (req, res) => {
  try {
    const { sessionId, participantId } = req.params;
    
    const result = await db.sql`
      DELETE FROM session_participants 
      WHERE id = ${participantId} AND session_id = ${sessionId}
      RETURNING *
    `;
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Participant not found in this session' });
    }
    
    // Update session participant count
    await db.sql`
      UPDATE sessions 
      SET total_checkins = (
        SELECT COUNT(*) FROM session_participants WHERE session_id = ${sessionId}
      ),
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sessionId}
    `;
    
    res.json({ message: 'Participant removed successfully' });
    
  } catch (error) {
    console.error('Remove participant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add traffic to session
router.post('/:id/traffic', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      from_call, 
      to_call, 
      message_number, 
      precedence = 'Routine', 
      message_text, 
      time_received, 
      handled_by, 
      notes 
    } = req.body;
    
    if (!from_call || !to_call) {
      return res.status(400).json({ error: 'From and To call signs are required' });
    }
    
    // Check if session exists
    const sessionCheck = await db.sql`
      SELECT id FROM sessions WHERE id = ${id}
    `;
    
    if (sessionCheck.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const result = await db.sql`
      INSERT INTO session_traffic (
        session_id, from_call, to_call, message_number, precedence, 
        message_text, time_received, handled_by, notes
      ) VALUES (
        ${id}, ${from_call.toUpperCase()}, ${to_call.toUpperCase()}, 
        ${message_number || null}, ${precedence}, ${message_text || null}, 
        ${time_received || null}, ${handled_by || null}, ${notes || null}
      ) RETURNING *
    `;
    
    // Update session traffic count
    await db.sql`
      UPDATE sessions 
      SET total_traffic = (
        SELECT COUNT(*) FROM session_traffic WHERE session_id = ${id}
      ),
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;
    
    res.status(201).json(result[0]);
    
  } catch (error) {
    console.error('Add traffic error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fix participant-operator links for existing participants
router.post('/:id/fix-participant-links', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const sessionId = parseInt(id);
    
    if (!sessionId || isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    
    // Get all participants in this session that don't have operator_id set
    const unlinkedParticipants = await db.sql`
      SELECT id, call_sign 
      FROM session_participants 
      WHERE session_id = ${sessionId} AND operator_id IS NULL
    `;
    
    let linkedCount = 0;
    let notFoundCount = 0;
    const results = [];
    
    for (const participant of unlinkedParticipants) {
      // Try to find matching operator
      const matchingOperator = await db.sql`
        SELECT id, name, city, state 
        FROM operators 
        WHERE call_sign = ${participant.call_sign.toUpperCase()}
      `;
      
      if (matchingOperator.length > 0) {
        // Link the participant to the operator
        await db.sql`
          UPDATE session_participants 
          SET operator_id = ${matchingOperator[0].id}
          WHERE id = ${participant.id}
        `;
        
        linkedCount++;
        results.push({
          participant_id: participant.id,
          call_sign: participant.call_sign,
          operator_id: matchingOperator[0].id,
          operator_name: matchingOperator[0].name,
          status: 'linked'
        });
      } else {
        notFoundCount++;
        results.push({
          participant_id: participant.id,
          call_sign: participant.call_sign,
          status: 'no_operator_found'
        });
      }
    }
    
    res.json({
      success: true,
      session_id: sessionId,
      total_participants: unlinkedParticipants.length,
      linked: linkedCount,
      not_found: notFoundCount,
      results
    });
    
  } catch (error) {
    console.error('Fix participant links error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fix traffic counts endpoint
router.post('/fix-traffic-counts', async (req, res) => {
  try {
    console.log('🔍 Checking traffic count discrepancies...');
    
    // Get all sessions with their stored total_traffic and actual count
    const sessions = await db.sql`
      SELECT 
        s.id,
        s.session_date,
        s.net_control_call,
        s.total_traffic as stored_count,
        COUNT(st.id) as actual_count
      FROM sessions s
      LEFT JOIN session_traffic st ON s.id = st.session_id
      GROUP BY s.id, s.session_date, s.net_control_call, s.total_traffic
      HAVING s.total_traffic != COUNT(st.id)
      ORDER BY s.session_date DESC
    `;
    
    if (sessions.length === 0) {
      return res.json({
        success: true,
        message: 'All traffic counts are correct!',
        fixed: 0,
        sessions: []
      });
    }
    
    console.log(`❌ Found ${sessions.length} sessions with incorrect traffic counts`);
    
    const fixedSessions = [];
    
    // Fix each session
    for (const session of sessions) {
      await db.sql`
        UPDATE sessions 
        SET total_traffic = (
          SELECT COUNT(*) FROM session_traffic WHERE session_id = ${session.id}
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ${session.id}
      `;
      
      fixedSessions.push({
        id: session.id,
        date: session.session_date,
        net_control: session.net_control_call,
        old_count: parseInt(session.stored_count),
        new_count: parseInt(session.actual_count)
      });
      
      console.log(`✅ Fixed session ${session.id}: ${session.stored_count} → ${session.actual_count}`);
    }
    
    console.log('🎉 All traffic counts have been corrected!');
    
    res.json({
      success: true,
      message: `Fixed ${sessions.length} sessions with incorrect traffic counts`,
      fixed: sessions.length,
      sessions: fixedSessions
    });
    
  } catch (error) {
    console.error('❌ Error fixing traffic counts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fix traffic counts',
      details: error.message
    });
  }
});

// Submit net report to external URL
router.post('/:id/submit-net-report', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get session data
    const sessionResult = await db.sql`
      SELECT s.*, 
             COUNT(DISTINCT sp.id) as checkin_count,
             COUNT(DISTINCT st.id) as traffic_count
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      LEFT JOIN session_traffic st ON s.id = st.session_id
      WHERE s.id = ${id}
      GROUP BY s.id
    `;

    if (sessionResult.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult[0];

    // Check for announcements (participants with flag_announcement)
    let hasAnnouncements = false;
    try {
      const announcementCheck = await db.sql`
        SELECT COUNT(*) as count FROM session_participants 
        WHERE session_id = ${id} AND flag_announcement = true
      `;
      hasAnnouncements = parseInt(announcementCheck[0].count) > 0;
    } catch (e) {
      // flag_announcement column may not exist yet
    }

    // Get net report URL from settings
    const urlSetting = await db.sql`
      SELECT value FROM settings WHERE key = 'netreport_url'
    `;

    if (!urlSetting.length || !urlSetting[0].value) {
      return res.status(503).json({ error: 'Net report URL not configured in settings' });
    }

    const baseUrl = urlSetting[0].value;

    // Parse the date
    const sessionDate = new Date(session.session_date);
    const month = String(sessionDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(sessionDate.getUTCDate()).padStart(2, '0');
    const year = sessionDate.getUTCFullYear();
    const formattedDate = `${month}/${day}/${year}`;

    // Extract first name from net_control_name
    const firstName = (session.net_control_name || '').split(' ')[0] || '';

    // Map mode: FM=1, SSB=2, etc (default 1)
    const modeMap = { 'FM': 1, 'SSB': 2, 'CW': 3, 'Digital': 4, 'DMR': 5 };
    const modeValue = modeMap[session.mode] || 1;

    // Build query params
    const params = new URLSearchParams({
      f: firstName,
      s: (session.net_control_call || '').toLowerCase(),
      d: formattedDate,
      m: modeValue,
      c: parseInt(session.checkin_count) || 0,
      t: parseInt(session.traffic_count) || 0,
      a: 'Yes'
    });

    const submitUrl = `${baseUrl}?${params.toString()}`;

    // Submit via GET request
    const axios = require('axios');
    const response = await axios.get(submitUrl, { timeout: 15000 });

    // Capture the response body from the external service
    let responseBody = '';
    if (typeof response.data === 'string') {
      responseBody = response.data;
    } else if (response.data) {
      responseBody = JSON.stringify(response.data);
    }

    res.json({
      success: true,
      message: 'Net report submitted successfully',
      url: submitUrl,
      response_status: response.status,
      response_body: responseBody,
      data: {
        firstName,
        callSign: session.net_control_call,
        date: formattedDate,
        mode: modeValue,
        checkins: parseInt(session.checkin_count) || 0,
        traffic: parseInt(session.traffic_count) || 0,
        announcements: 'Yes'
      }
    });

  } catch (error) {
    console.error('Submit net report error:', error);
    if (error.response) {
      res.status(error.response.status).json({
        error: 'Net report submission failed',
        details: `HTTP ${error.response.status}: ${error.response.statusText}`
      });
    } else {
      res.status(500).json({ error: error.message || 'Failed to submit net report' });
    }
  }
});

// Import historical summary sessions from CSV/text data
router.post('/import-summary', authenticateToken, requireWrite, async (req, res) => {
  try {
    const { data, frequency, mode, start_time, overwrite } = req.body;

    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'No import data provided' });
    }

    const lines = data.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length === 0) {
      return res.status(400).json({ error: 'No valid lines found in import data' });
    }

    // QRZ lookup helper
    const { getQRZSession, mapLicenseClass } = require('./qrz-postgres-js');
    const xml2js = require('xml2js');

    async function lookupAndCreateOperator(callSign, firstName) {
      // Check if operator already exists
      const existing = await db.sql`
        SELECT id, name FROM operators WHERE call_sign = ${callSign}
      `;
      if (existing.length > 0) {
        return { operatorId: existing[0].id, created: false, fullName: existing[0].name || firstName };
      }

      // Try QRZ lookup
      let qrzData = null;
      try {
        const sessionKey = await getQRZSession();
        const lookupUrl = 'https://xmldata.qrz.com/xml/current/';
        const response = await axios.get(lookupUrl, {
          params: { s: sessionKey, callsign: callSign },
          timeout: 10000
        });
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);
        if (result.QRZDatabase && result.QRZDatabase.Callsign && result.QRZDatabase.Callsign[0]) {
          const d = result.QRZDatabase.Callsign[0];
          qrzData = {
            name: d.fname && d.name ? `${d.fname[0]} ${d.name[0]}` : (d.name ? d.name[0] : ''),
            address: d.addr1 ? d.addr1[0] : '',
            city: d.addr2 ? d.addr2[0] : '',
            state: d.state ? d.state[0] : '',
            email: d.email ? d.email[0] : '',
            grid: d.grid ? d.grid[0] : '',
            licenseClass: mapLicenseClass(d.class ? d.class[0] : '')
          };
        }
      } catch (qrzErr) {
        console.log(`QRZ lookup failed for ${callSign} during import: ${qrzErr.message}`);
      }

      // Create operator record
      const operatorName = qrzData?.name || firstName || null;
      const newOp = await db.sql`
        INSERT INTO operators (call_sign, name, address, city, state, email, license_class, active, notes)
        VALUES (
          ${callSign},
          ${operatorName},
          ${qrzData?.address || null},
          ${qrzData?.city || null},
          ${qrzData?.state || null},
          ${qrzData?.email || null},
          ${qrzData?.licenseClass || null},
          true,
          ${qrzData ? `Added from QRZ during historical import. Grid: ${qrzData.grid || 'N/A'}` : `Added during historical import`}
        ) RETURNING id
      `;

      return { operatorId: newOp[0].id, created: true, hasQRZ: !!qrzData, fullName: operatorName };
    }

    const results = [];
    const errors = [];
    const duplicates = [];
    let operatorsCreated = 0;

    for (let i = 0; i < lines.length; i++) {
      try {
        const line = lines[i];
        const parts = line.split(/\s+/);

        if (parts.length < 7) {
          errors.push({ line: i + 1, text: line, error: `Expected 7 fields, got ${parts.length}` });
          continue;
        }

        const firstName = parts[0];
        const callSign = parts[1].toUpperCase();
        const dateStr = parts[2];
        const messageNumber = parts[3];
        const participantCount = parseInt(parts[4]) || 0;
        const trafficCount = parseInt(parts[5]) || 0;
        const announce = parts.slice(6).join(' ');

        const dateParts = dateStr.split('/');
        if (dateParts.length !== 3) {
          errors.push({ line: i + 1, text: line, error: `Invalid date format: ${dateStr}` });
          continue;
        }
        const sessionDate = `${dateParts[2]}-${dateParts[0].padStart(2, '0')}-${dateParts[1].padStart(2, '0')}`;

        // Ensure operator exists (QRZ lookup + create if needed)
        let operatorResult;
        try {
          operatorResult = await lookupAndCreateOperator(callSign, firstName);
          if (operatorResult.created) operatorsCreated++;
        } catch (opErr) {
          console.error(`Operator creation failed for ${callSign}:`, opErr.message);
          operatorResult = { operatorId: null, created: false, fullName: firstName };
        }

        const fullName = operatorResult.fullName || firstName;
        const notes = `Imported summary. Msg#: ${messageNumber}. Announce: ${announce}`;

        const existing = await db.sql`
          SELECT id FROM sessions WHERE session_date = ${sessionDate} AND net_control_call = ${callSign}
        `;

        if (existing.length > 0) {
          if (overwrite) {
            await db.sql`
              UPDATE sessions SET
                net_control_name = ${fullName},
                frequency = ${frequency || null},
                mode = ${mode || 'FM'},
                start_time = ${start_time || null},
                notes = ${notes},
                total_checkins = ${participantCount},
                total_traffic = ${trafficCount},
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ${existing[0].id}
            `;
            results.push({
              line: i + 1,
              session: { id: existing[0].id, session_date: sessionDate, net_control_call: callSign, total_checkins: participantCount, total_traffic: trafficCount },
              firstName: fullName, callSign, date: dateStr, participants: participantCount, traffic: trafficCount,
              overwritten: true, operatorCreated: operatorResult.created
            });
          } else {
            duplicates.push({ line: i + 1, text: line, callSign, date: dateStr, existingId: existing[0].id });
          }
          continue;
        }

        const result = await db.sql`
          INSERT INTO sessions (
            session_date, net_control_call, net_control_name,
            frequency, mode, start_time, notes,
            total_checkins, total_traffic
          ) VALUES (
            ${sessionDate}, ${callSign.toUpperCase()}, ${fullName},
            ${frequency || null}, ${mode || 'FM'}, ${start_time || null}, ${notes},
            ${participantCount}, ${trafficCount}
          ) RETURNING id, session_date, net_control_call, total_checkins, total_traffic
        `;

        results.push({
          line: i + 1,
          session: result[0],
          firstName: fullName, callSign, date: dateStr, participants: participantCount, traffic: trafficCount,
          operatorCreated: operatorResult.created
        });
      } catch (lineError) {
        errors.push({ line: i + 1, text: lines[i], error: lineError.message });
      }
    }

    res.json({
      success: true,
      imported: results.length,
      failed: errors.length,
      duplicates: duplicates.length,
      operatorsCreated,
      total: lines.length,
      results,
      errors,
      duplicates
    });
  } catch (error) {
    console.error('Import summary sessions error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router;