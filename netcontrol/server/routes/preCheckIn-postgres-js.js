const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const axios = require('axios');
const { authenticateToken } = require('./auth-postgres-js');

// Fetch pre-check-in data from BRARS website
router.get('/', authenticateToken, async (req, res) => {
  try {
    // This is a placeholder implementation
    // In a real implementation, you would fetch from the actual pre-check-in source
    
    // For now, return empty data
    const participants = [];
    
    res.json({
      participants,
      count: participants.length,
      fetchedAt: new Date().toISOString(),
      source: 'BRARS Pre-Net CheckIn'
    });
    
  } catch (error) {
    console.error('Pre-check-in fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch pre-check-in data' });
  }
});

// Process pre-check-in participants with QRZ lookup and operator creation
router.post('/process', authenticateToken, async (req, res) => {
  try {
    const { participants, sessionId } = req.body;
    
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'No participants provided' });
    }
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Check if session exists
    const sessionCheck = await db.sql`
      SELECT id FROM sessions WHERE id = ${sessionId}
    `;
    
    if (sessionCheck.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const results = [];
    const errors = [];
    
    for (const participant of participants) {
      try {
        const { callSign, firstName, location, announce } = participant;
        
        if (!callSign) {
          errors.push({ participant, error: 'Call sign is required' });
          continue;
        }
        
        // Check if participant already exists in this session
        const existingParticipant = await db.sql`
          SELECT id FROM session_participants 
          WHERE session_id = ${sessionId} AND call_sign = ${callSign.toUpperCase()}
        `;
        
        if (existingParticipant.length > 0) {
          errors.push({ participant, error: 'Participant already exists in session' });
          continue;
        }
        
        // Check if operator exists, create if not
        let operatorExists = await db.sql`
          SELECT id FROM operators WHERE call_sign = ${callSign.toUpperCase()}
        `;
        
        if (operatorExists.length === 0) {
          // Create operator from pre-check-in data
          await db.sql`
            INSERT INTO operators (call_sign, name, city, active, notes)
            VALUES (
              ${callSign.toUpperCase()}, 
              ${firstName || null}, 
              ${location || null}, 
              true,
              ${`Added from pre-check-in on ${new Date().toLocaleDateString()}. ${announce || ''}`}
            )
          `;
        }
        
        // Add participant to session
        const participantResult = await db.sql`
          INSERT INTO session_participants (
            session_id, call_sign, name, notes
          ) VALUES (
            ${sessionId}, ${callSign.toUpperCase()}, ${firstName || null}, 
            ${`Pre-check-in: ${announce || 'No announcement'}`}
          ) RETURNING *
        `;
        
        results.push({
          participant,
          added: participantResult[0],
          status: 'success'
        });
        
      } catch (error) {
        console.error(`Error processing participant ${participant.callSign}:`, error);
        errors.push({ 
          participant, 
          error: error.message || 'Failed to process participant' 
        });
      }
    }
    
    // Update session participant count
    if (results.length > 0) {
      await db.sql`
        UPDATE sessions 
        SET total_checkins = (
          SELECT COUNT(*) FROM session_participants WHERE session_id = ${sessionId}
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sessionId}
      `;
    }
    
    res.json({
      success: true,
      processed: results.length,
      errors: errors.length,
      results,
      errors
    });
    
  } catch (error) {
    console.error('Process pre-check-in error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;