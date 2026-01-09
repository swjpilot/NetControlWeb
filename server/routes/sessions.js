const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const { authenticateToken } = require('./auth-postgres-js');

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
    const { limit = 25, offset = 0 } = req.query;
    
    // Use the same approach as the working dashboard stats
    // First get total count using the same method as dashboard
    const countResult = await db.sql`
      SELECT COUNT(DISTINCT s.id) as count 
      FROM sessions s
    `;
    const total = parseInt(countResult[0].count);
    
    // Get sessions using a simple query
    const sessions = await db.sql`
      SELECT s.id, s.session_date, s.net_control_call, s.net_control_name, 
             s.start_time, s.end_time, s.frequency, s.mode, s.notes,
             s.created_at, s.updated_at
      FROM sessions s
      ORDER BY s.session_date DESC, s.start_time DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    
    // Calculate actual counts for each session
    const sessionsWithCounts = [];
    for (const session of sessions) {
      // Get participant count
      const participantResult = await db.sql`
        SELECT COUNT(*) as count FROM session_participants WHERE session_id = ${session.id}
      `;
      const participant_count = parseInt(participantResult[0].count) || 0;
      
      // Get traffic count
      const trafficResult = await db.sql`
        SELECT COUNT(*) as count FROM session_traffic WHERE session_id = ${session.id}
      `;
      const traffic_count = parseInt(trafficResult[0].count) || 0;
      
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
        COUNT(sp.id) as total_participants,
        COUNT(st.id) as total_traffic_handled
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      LEFT JOIN session_traffic st ON s.id = st.session_id
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
             o.name as operator_name, 
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
    
    // Add counts
    const participant_count = participants.length;
    const traffic_count = traffic.length;
    
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
router.post('/', authenticateToken, async (req, res) => {
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
        ${session_date}, ${net_control_call}, ${net_control_name || null}, 
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
router.put('/:id', authenticateToken, async (req, res) => {
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
        net_control_call = ${net_control_call},
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
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.sql`
      DELETE FROM sessions WHERE id = ${id} RETURNING *
    `;
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({ message: 'Session deleted successfully' });
    
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add participant to session
router.post('/:id/participants', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { call_sign, name, check_in_time, check_out_time, notes, operator_id } = req.body;
    
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
        session_id, call_sign, name, check_in_time, check_out_time, notes, operator_id
      ) VALUES (
        ${id}, ${call_sign.toUpperCase()}, ${name || null}, 
        ${check_in_time || null}, ${check_out_time || null}, ${notes || null}, ${finalOperatorId || null}
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
    const { call_sign, name, check_in_time, check_out_time, notes, operator_id } = req.body;
    
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

module.exports = router;