const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const { authenticateToken } = require('./auth-postgres-js');

// Get session summary report
router.get('/session-summary', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let whereConditions = [];
    
    if (start_date) {
      whereConditions.push(`session_date >= '${start_date}'`);
    }
    
    if (end_date) {
      whereConditions.push(`session_date <= '${end_date}'`);
    }
    
    // Get summary statistics
    let summaryQuery;
    if (whereConditions.length > 0) {
      summaryQuery = db.sql`
        SELECT 
          COUNT(*) as total_sessions,
          SUM(total_checkins) as total_participants,
          AVG(total_checkins) as avg_participants,
          SUM(total_traffic) as total_traffic
        FROM sessions
        WHERE ${db.sql.unsafe(whereConditions.join(' AND '))}
      `;
    } else {
      summaryQuery = db.sql`
        SELECT 
          COUNT(*) as total_sessions,
          SUM(total_checkins) as total_participants,
          AVG(total_checkins) as avg_participants,
          SUM(total_traffic) as total_traffic
        FROM sessions
      `;
    }
    
    const summaryResult = await summaryQuery;
    const summary = summaryResult[0];
    
    // Get sessions list
    let sessionsQuery;
    if (whereConditions.length > 0) {
      sessionsQuery = db.sql`
        SELECT session_date, net_control_call, net_control_name, frequency, 
               total_checkins, total_traffic, notes
        FROM sessions
        WHERE ${db.sql.unsafe(whereConditions.join(' AND '))}
        ORDER BY session_date DESC
      `;
    } else {
      sessionsQuery = db.sql`
        SELECT session_date, net_control_call, net_control_name, frequency, 
               total_checkins, total_traffic, notes
        FROM sessions
        ORDER BY session_date DESC
      `;
    }
    
    const sessions = await sessionsQuery;
    
    res.json({
      summary: {
        total_sessions: parseInt(summary.total_sessions) || 0,
        total_participants: parseInt(summary.total_participants) || 0,
        avg_participants: parseFloat(summary.avg_participants) || 0,
        total_traffic: parseInt(summary.total_traffic) || 0
      },
      sessions
    });
    
  } catch (error) {
    console.error('Session summary report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get operator activity report
router.get('/operator-activity', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let whereConditions = [];
    
    if (start_date) {
      whereConditions.push(`session_date >= '${start_date}'`);
    }
    
    if (end_date) {
      whereConditions.push(`session_date <= '${end_date}'`);
    }
    
    let activityQuery;
    if (whereConditions.length > 0) {
      activityQuery = db.sql`
        SELECT 
          net_control_call,
          net_control_name,
          COUNT(*) as sessions_controlled,
          SUM(total_checkins) as total_checkins_handled,
          SUM(total_traffic) as total_traffic_handled,
          MIN(session_date) as first_session,
          MAX(session_date) as last_session
        FROM sessions
        WHERE ${db.sql.unsafe(whereConditions.join(' AND '))}
        GROUP BY net_control_call, net_control_name
        ORDER BY sessions_controlled DESC, total_checkins_handled DESC
      `;
    } else {
      activityQuery = db.sql`
        SELECT 
          net_control_call,
          net_control_name,
          COUNT(*) as sessions_controlled,
          SUM(total_checkins) as total_checkins_handled,
          SUM(total_traffic) as total_traffic_handled,
          MIN(session_date) as first_session,
          MAX(session_date) as last_session
        FROM sessions
        GROUP BY net_control_call, net_control_name
        ORDER BY sessions_controlled DESC, total_checkins_handled DESC
      `;
    }
    
    const operators = await activityQuery;
    
    res.json({
      operators: operators.map(op => ({
        ...op,
        sessions_controlled: parseInt(op.sessions_controlled),
        total_checkins_handled: parseInt(op.total_checkins_handled) || 0,
        total_traffic_handled: parseInt(op.total_traffic_handled) || 0
      }))
    });
    
  } catch (error) {
    console.error('Operator activity report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get frequency usage report
router.get('/frequency-usage', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let whereConditions = [];
    
    if (start_date) {
      whereConditions.push(`session_date >= '${start_date}'`);
    }
    
    if (end_date) {
      whereConditions.push(`session_date <= '${end_date}'`);
    }
    
    let frequencyQuery;
    if (whereConditions.length > 0) {
      frequencyQuery = db.sql`
        SELECT 
          frequency,
          mode,
          COUNT(*) as usage_count,
          SUM(total_checkins) as total_checkins,
          SUM(total_traffic) as total_traffic,
          MIN(session_date) as first_used,
          MAX(session_date) as last_used
        FROM sessions
        WHERE frequency IS NOT NULL AND frequency != '' 
          AND ${db.sql.unsafe(whereConditions.join(' AND '))}
        GROUP BY frequency, mode
        ORDER BY usage_count DESC, total_checkins DESC
      `;
    } else {
      frequencyQuery = db.sql`
        SELECT 
          frequency,
          mode,
          COUNT(*) as usage_count,
          SUM(total_checkins) as total_checkins,
          SUM(total_traffic) as total_traffic,
          MIN(session_date) as first_used,
          MAX(session_date) as last_used
        FROM sessions
        WHERE frequency IS NOT NULL AND frequency != ''
        GROUP BY frequency, mode
        ORDER BY usage_count DESC, total_checkins DESC
      `;
    }
    
    const frequencies = await frequencyQuery;
    
    res.json({
      frequencies: frequencies.map(freq => ({
        ...freq,
        usage_count: parseInt(freq.usage_count),
        total_checkins: parseInt(freq.total_checkins) || 0,
        total_traffic: parseInt(freq.total_traffic) || 0
      }))
    });
    
  } catch (error) {
    console.error('Frequency usage report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get monthly statistics report
router.get('/monthly-stats', authenticateToken, async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year || new Date().getFullYear();
    
    const monthlyQuery = db.sql`
      SELECT 
        EXTRACT(MONTH FROM session_date) as month,
        EXTRACT(YEAR FROM session_date) as year,
        COUNT(*) as session_count,
        SUM(total_checkins) as total_checkins,
        SUM(total_traffic) as total_traffic,
        AVG(total_checkins) as avg_checkins_per_session
      FROM sessions
      WHERE EXTRACT(YEAR FROM session_date) = ${parseInt(targetYear)}
      GROUP BY EXTRACT(YEAR FROM session_date), EXTRACT(MONTH FROM session_date)
      ORDER BY month
    `;
    
    const monthlyStats = await monthlyQuery;
    
    // Fill in missing months with zero values
    const months = [];
    for (let i = 1; i <= 12; i++) {
      const monthData = monthlyStats.find(m => parseInt(m.month) === i);
      months.push({
        month: i,
        year: parseInt(targetYear),
        session_count: monthData ? parseInt(monthData.session_count) : 0,
        total_checkins: monthData ? parseInt(monthData.total_checkins) || 0 : 0,
        total_traffic: monthData ? parseInt(monthData.total_traffic) || 0 : 0,
        avg_checkins_per_session: monthData ? parseFloat(monthData.avg_checkins_per_session) || 0 : 0
      });
    }
    
    res.json({
      year: parseInt(targetYear),
      months
    });
    
  } catch (error) {
    console.error('Monthly stats report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get traffic report
router.get('/traffic', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let whereConditions = [];
    
    if (start_date) {
      whereConditions.push(`session_date >= '${start_date}'`);
    }
    
    if (end_date) {
      whereConditions.push(`session_date <= '${end_date}'`);
    }
    
    let trafficQuery;
    if (whereConditions.length > 0) {
      trafficQuery = db.sql`
        SELECT 
          session_date,
          net_control_call,
          net_control_name,
          frequency,
          total_traffic,
          notes
        FROM sessions
        WHERE total_traffic > 0 
          AND ${db.sql.unsafe(whereConditions.join(' AND '))}
        ORDER BY session_date DESC, total_traffic DESC
      `;
    } else {
      trafficQuery = db.sql`
        SELECT 
          session_date,
          net_control_call,
          net_control_name,
          frequency,
          total_traffic,
          notes
        FROM sessions
        WHERE total_traffic > 0
        ORDER BY session_date DESC, total_traffic DESC
      `;
    }
    
    const trafficSessions = await trafficQuery;
    
    // Get summary
    let summaryQuery;
    if (whereConditions.length > 0) {
      summaryQuery = db.sql`
        SELECT 
          COUNT(*) as sessions_with_traffic,
          SUM(total_traffic) as total_traffic_handled,
          AVG(total_traffic) as avg_traffic_per_session,
          MAX(total_traffic) as max_traffic_session
        FROM sessions
        WHERE total_traffic > 0 
          AND ${db.sql.unsafe(whereConditions.join(' AND '))}
      `;
    } else {
      summaryQuery = db.sql`
        SELECT 
          COUNT(*) as sessions_with_traffic,
          SUM(total_traffic) as total_traffic_handled,
          AVG(total_traffic) as avg_traffic_per_session,
          MAX(total_traffic) as max_traffic_session
        FROM sessions
        WHERE total_traffic > 0
      `;
    }
    
    const summaryResult = await summaryQuery;
    const summary = summaryResult[0];
    
    res.json({
      summary: {
        sessions_with_traffic: parseInt(summary.sessions_with_traffic) || 0,
        total_traffic_handled: parseInt(summary.total_traffic_handled) || 0,
        avg_traffic_per_session: parseFloat(summary.avg_traffic_per_session) || 0,
        max_traffic_session: parseInt(summary.max_traffic_session) || 0
      },
      sessions: trafficSessions.map(session => ({
        ...session,
        total_traffic: parseInt(session.total_traffic)
      }))
    });
    
  } catch (error) {
    console.error('Traffic report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;