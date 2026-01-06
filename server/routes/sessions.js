const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken } = require('./auth');

// Get all sessions with pagination and filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      limit = 25, 
      offset = 0, 
      search, 
      date_from, 
      date_to, 
      net_control 
    } = req.query;
    
    // Build WHERE conditions
    let whereConditions = [];
    let params = [];
    
    if (search) {
      whereConditions.push(`(
        s.net_control_call LIKE ? OR 
        s.net_control_name LIKE ? OR 
        s.frequency LIKE ? OR
        s.notes LIKE ?
      )`);
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }
    
    if (date_from) {
      whereConditions.push(`s.session_date >= ?`);
      params.push(date_from);
    }
    
    if (date_to) {
      whereConditions.push(`s.session_date <= ?`);
      params.push(date_to);
    }
    
    if (net_control) {
      whereConditions.push(`s.net_control_call = ?`);
      params.push(net_control);
    }
    
    const whereClause = whereConditions.length > 0 ? 
      `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM sessions s 
      ${whereClause}
    `;
    const totalResult = await db.get(countQuery, params);
    const total = totalResult.total;
    
    // Get paginated results with participant and traffic counts
    const dataQuery = `
      SELECT 
        s.*,
        COALESCE(u.username, 'Unknown') as created_by_username,
        COUNT(DISTINCT sp.id) as participant_count,
        COUNT(DISTINCT st.id) as traffic_count
      FROM sessions s
      LEFT JOIN users u ON s.created_by = u.id
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      LEFT JOIN session_traffic st ON s.id = st.session_id
      ${whereClause}
      GROUP BY s.id
      ORDER BY s.session_date DESC, s.start_time DESC
      LIMIT ? OFFSET ?
    `;
    
    const dataParams = [...params, parseInt(limit), parseInt(offset)];
    const sessions = await db.all(dataQuery, dataParams);
    
    res.json({ 
      sessions,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: (parseInt(offset) + sessions.length) < total
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get single session with full details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get session details
    const session = await db.get(`
      SELECT s.*, u.username as created_by_username
      FROM sessions s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = ?
    `, [id]);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Get participants
    const participants = await db.all(`
      SELECT 
        sp.*, 
        o.name as operator_name,
        o.call_sign as operator_call,
        o.location as operator_location,
        COALESCE(o.call_sign, sp.call_sign) as display_call_sign,
        COALESCE(o.name, '') as display_name,
        COALESCE(o.location, '') as display_location
      FROM session_participants sp
      LEFT JOIN operators o ON sp.operator_id = o.id
      WHERE sp.session_id = ?
      ORDER BY sp.check_in_time ASC
    `, [id]);
    
    // Get traffic
    const traffic = await db.all(`
      SELECT st.*, 
        o_from.call_sign as from_call, o_from.name as from_name,
        o_to.call_sign as to_call, o_to.name as to_name
      FROM session_traffic st
      LEFT JOIN operators o_from ON st.from_operator_id = o_from.id
      LEFT JOIN operators o_to ON st.to_operator_id = o_to.id
      WHERE st.session_id = ?
      ORDER BY st.created_at ASC
    `, [id]);
    
    res.json({ 
      session: {
        ...session,
        participants,
        traffic
      }
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Create new session
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      session_date,
      start_time,
      end_time,
      net_control_call,
      net_control_name,
      frequency,
      mode,
      power,
      antenna,
      weather,
      notes,
      net_type
    } = req.body;
    
    // Validate required fields
    if (!session_date || !net_control_call) {
      return res.status(400).json({ error: 'Session date and net control call are required' });
    }
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(session_date)) {
      return res.status(400).json({ error: 'Invalid date format (YYYY-MM-DD required)' });
    }
    
    // Check if session already exists for this date
    const existing = await db.get(
      'SELECT id FROM sessions WHERE session_date = ?', 
      [session_date]
    );
    if (existing) {
      return res.status(400).json({ error: 'Session already exists for this date' });
    }
    
    // Insert new session
    const result = await db.run(`
      INSERT INTO sessions (
        session_date, start_time, end_time, net_control_call, net_control_name,
        frequency, mode, power, antenna, weather, notes, net_type,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      session_date,
      start_time || null,
      end_time || null,
      net_control_call.toUpperCase(),
      net_control_name || null,
      frequency || null,
      mode || 'FM',
      power || null,
      antenna || null,
      weather || null,
      notes || null,
      net_type || 'Regular',
      req.user.id
    ]);
    
    // Fetch the created session
    const newSession = await db.get(`
      SELECT s.*, u.username as created_by_username
      FROM sessions s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = ?
    `, [result.id]);
    
    console.log(`Session ${session_date} created by user ${req.user.username}`);
    
    res.status(201).json({ 
      message: 'Session created successfully',
      session: newSession
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Update session
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      session_date,
      start_time,
      end_time,
      net_control_call,
      net_control_name,
      frequency,
      mode,
      power,
      antenna,
      weather,
      notes,
      net_type
    } = req.body;
    
    // Check if session exists
    const existing = await db.get('SELECT * FROM sessions WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Validate required fields
    if (!session_date || !net_control_call) {
      return res.status(400).json({ error: 'Session date and net control call are required' });
    }
    
    // Check if date conflicts with another session (excluding current)
    const duplicateDate = await db.get(
      'SELECT id FROM sessions WHERE session_date = ? AND id != ?', 
      [session_date, id]
    );
    if (duplicateDate) {
      return res.status(400).json({ error: 'Another session already exists for this date' });
    }
    
    // Update session
    await db.run(`
      UPDATE sessions SET
        session_date = ?, start_time = ?, end_time = ?, net_control_call = ?,
        net_control_name = ?, frequency = ?, mode = ?, power = ?, antenna = ?,
        weather = ?, notes = ?, net_type = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      session_date,
      start_time || null,
      end_time || null,
      net_control_call.toUpperCase(),
      net_control_name || null,
      frequency || null,
      mode || 'FM',
      power || null,
      antenna || null,
      weather || null,
      notes || null,
      net_type || 'Regular',
      id
    ]);
    
    // Fetch the updated session
    const updatedSession = await db.get(`
      SELECT s.*, u.username as created_by_username
      FROM sessions s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = ?
    `, [id]);
    
    console.log(`Session ${session_date} updated by user ${req.user.username}`);
    
    res.json({ 
      message: 'Session updated successfully',
      session: updatedSession
    });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Delete session
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if session exists
    const existing = await db.get('SELECT session_date FROM sessions WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Delete related records first (foreign key constraints)
    await db.run('DELETE FROM session_participants WHERE session_id = ?', [id]);
    await db.run('DELETE FROM session_traffic WHERE session_id = ?', [id]);
    
    // Delete session
    await db.run('DELETE FROM sessions WHERE id = ?', [id]);
    
    console.log(`Session ${existing.session_date} deleted by user ${req.user.username}`);
    
    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Add participant to session
router.post('/:id/participants', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    let { operator_id, call_sign, check_in_time, check_out_time, notes } = req.body;
    
    // Validate session exists
    const session = await db.get('SELECT id FROM sessions WHERE id = ?', [id]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Validate required fields
    if (!operator_id && !call_sign) {
      return res.status(400).json({ error: 'Either operator_id or call_sign is required' });
    }
    
    // If operator_id is provided, get the call_sign from operators table
    if (operator_id && !call_sign) {
      const operator = await db.get('SELECT call_sign FROM operators WHERE id = ?', [operator_id]);
      if (operator) {
        call_sign = operator.call_sign;
      }
    }
    
    // If call_sign is provided but no operator_id, try to find existing operator
    if (call_sign && !operator_id) {
      const operator = await db.get('SELECT id FROM operators WHERE UPPER(call_sign) = UPPER(?)', [call_sign]);
      if (operator) {
        operator_id = operator.id;
      }
    }
    
    // Check if participant already exists in this session
    const existingParticipant = await db.get(`
      SELECT id FROM session_participants 
      WHERE session_id = ? AND (
        (operator_id IS NOT NULL AND operator_id = ?) OR 
        (call_sign IS NOT NULL AND UPPER(call_sign) = UPPER(?))
      )
    `, [id, operator_id, call_sign]);
    
    if (existingParticipant) {
      return res.status(400).json({ error: 'Participant already exists in this session' });
    }
    
    // Add participant
    const result = await db.run(`
      INSERT INTO session_participants (
        session_id, operator_id, call_sign, check_in_time, check_out_time, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      id,
      operator_id || null,
      call_sign ? call_sign.toUpperCase() : null,
      check_in_time || null,
      check_out_time || null,
      notes || null
    ]);
    
    // Fetch the created participant with operator details
    const newParticipant = await db.get(`
      SELECT 
        sp.*,
        o.name as operator_name, 
        o.call_sign as operator_call,
        o.location as operator_location,
        COALESCE(o.call_sign, sp.call_sign) as display_call_sign,
        COALESCE(o.name, '') as display_name,
        COALESCE(o.location, '') as display_location
      FROM session_participants sp
      LEFT JOIN operators o ON sp.operator_id = o.id
      WHERE sp.id = ?
    `, [result.id]);
    
    console.log('Created participant with operator details:', {
      id: newParticipant.id,
      operator_id: newParticipant.operator_id,
      call_sign: newParticipant.call_sign,
      display_call_sign: newParticipant.display_call_sign,
      display_name: newParticipant.display_name,
      operator_name: newParticipant.operator_name,
      operator_call: newParticipant.operator_call
    });
    
    res.status(201).json({ 
      message: 'Participant added successfully',
      participant: newParticipant
    });
  } catch (error) {
    console.error('Error adding participant:', error);
    res.status(500).json({ error: 'Failed to add participant' });
  }
});

// Update participant
router.put('/:sessionId/participants/:participantId', authenticateToken, async (req, res) => {
  try {
    const { sessionId, participantId } = req.params;
    const { check_in_time, check_out_time, notes } = req.body;
    
    // Check if participant exists
    const existing = await db.get(
      'SELECT * FROM session_participants WHERE id = ? AND session_id = ?', 
      [participantId, sessionId]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    
    // Update participant
    await db.run(`
      UPDATE session_participants SET
        check_in_time = ?, check_out_time = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      check_in_time || null,
      check_out_time || null,
      notes || null,
      participantId
    ]);
    
    // Fetch updated participant
    const updatedParticipant = await db.get(`
      SELECT sp.*, o.name as operator_name, o.call_sign as operator_call
      FROM session_participants sp
      LEFT JOIN operators o ON sp.operator_id = o.id
      WHERE sp.id = ?
    `, [participantId]);
    
    res.json({ 
      message: 'Participant updated successfully',
      participant: updatedParticipant
    });
  } catch (error) {
    console.error('Error updating participant:', error);
    res.status(500).json({ error: 'Failed to update participant' });
  }
});

// Remove participant from session
router.delete('/:sessionId/participants/:participantId', authenticateToken, async (req, res) => {
  try {
    const { sessionId, participantId } = req.params;
    
    // Check if participant exists
    const existing = await db.get(
      'SELECT call_sign FROM session_participants WHERE id = ? AND session_id = ?', 
      [participantId, sessionId]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    
    // Delete participant
    await db.run('DELETE FROM session_participants WHERE id = ?', [participantId]);
    
    res.json({ message: 'Participant removed successfully' });
  } catch (error) {
    console.error('Error removing participant:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

// Add traffic to session
router.post('/:id/traffic', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      from_operator_id, 
      to_operator_id, 
      from_call, 
      to_call, 
      message_type, 
      precedence, 
      message_content, 
      notes 
    } = req.body;
    
    // Validate session exists
    const session = await db.get('SELECT id FROM sessions WHERE id = ?', [id]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Validate required fields
    if ((!from_operator_id && !from_call) || (!to_operator_id && !to_call)) {
      return res.status(400).json({ error: 'From and To information is required' });
    }
    
    // Add traffic
    const result = await db.run(`
      INSERT INTO session_traffic (
        session_id, from_operator_id, to_operator_id, from_call, to_call,
        message_type, precedence, message_content, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      id,
      from_operator_id || null,
      to_operator_id || null,
      from_call ? from_call.toUpperCase() : null,
      to_call ? to_call.toUpperCase() : null,
      message_type || 'Routine',
      precedence || 'Routine',
      message_content || null,
      notes || null
    ]);
    
    // Fetch the created traffic with operator details
    const newTraffic = await db.get(`
      SELECT st.*, 
        o_from.call_sign as from_operator_call, o_from.name as from_operator_name,
        o_to.call_sign as to_operator_call, o_to.name as to_operator_name
      FROM session_traffic st
      LEFT JOIN operators o_from ON st.from_operator_id = o_from.id
      LEFT JOIN operators o_to ON st.to_operator_id = o_to.id
      WHERE st.id = ?
    `, [result.id]);
    
    res.status(201).json({ 
      message: 'Traffic added successfully',
      traffic: newTraffic
    });
  } catch (error) {
    console.error('Error adding traffic:', error);
    res.status(500).json({ error: 'Failed to add traffic' });
  }
});

// Get session statistics
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN session_date >= date('now', '-30 days') THEN 1 END) as sessions_last_30_days,
        COUNT(CASE WHEN session_date >= date('now', '-7 days') THEN 1 END) as sessions_last_7_days,
        AVG(
          (SELECT COUNT(*) FROM session_participants sp WHERE sp.session_id = s.id)
        ) as avg_participants_per_session,
        SUM(
          (SELECT COUNT(*) FROM session_traffic st WHERE st.session_id = s.id)
        ) as total_traffic_handled
      FROM sessions s
    `);
    
    res.json({ stats });
  } catch (error) {
    console.error('Error fetching session stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Debug endpoint to check sessions table structure
router.get('/debug/table-info', authenticateToken, async (req, res) => {
  try {
    const tableInfo = await db.all(`PRAGMA table_info(sessions)`);
    const sessionCount = await db.get(`SELECT COUNT(*) as count FROM sessions`);
    const sampleSessions = await db.all(`SELECT * FROM sessions LIMIT 5`);
    
    res.json({ 
      tableInfo,
      sessionCount,
      sampleSessions
    });
  } catch (error) {
    console.error('Error fetching debug info:', error);
    res.status(500).json({ error: 'Failed to fetch debug info' });
  }
});

module.exports = router;