const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const { authenticateToken } = require('./auth-postgres-js');

// Get monthly net controller report
router.get('/monthly-net-control', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    console.log('Generating report for:', { start_date, end_date });

    // 1. Get summary by net controller (total check-ins per controller)
    const controllerSummary = await db.sql`
      SELECT 
        s.net_control_call,
        s.net_control_name,
        COUNT(DISTINCT s.id) as sessions_count,
        COUNT(sp.id) as total_checkins
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
        AND s.net_control_call IS NOT NULL
      GROUP BY s.net_control_call, s.net_control_name
      ORDER BY s.net_control_call ASC
    `;

    // 2. Get detailed breakdown by controller and session
    const controllerDetails = await db.sql`
      SELECT 
        s.net_control_call,
        s.net_control_name,
        s.session_date,
        s.id as session_id,
        COUNT(sp.id) as checkins
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
        AND s.net_control_call IS NOT NULL
      GROUP BY s.id, s.net_control_call, s.net_control_name, s.session_date
      ORDER BY s.net_control_call ASC, s.session_date ASC
    `;

    // 3. Get chronological list (by date)
    const chronologicalList = await db.sql`
      SELECT 
        s.session_date,
        s.net_control_call,
        s.net_control_name,
        s.id as session_id,
        COUNT(sp.id) as checkins
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
        AND s.net_control_call IS NOT NULL
      GROUP BY s.id, s.session_date, s.net_control_call, s.net_control_name
      ORDER BY s.session_date ASC
    `;

    // 4. Calculate statistics
    const stats = await db.sql`
      SELECT 
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(DISTINCT s.net_control_call) as unique_controllers,
        COUNT(sp.id) as total_checkins,
        ROUND(AVG(session_checkins.checkins), 2) as avg_checkins_per_session,
        MAX(session_checkins.checkins) as max_checkins_session,
        MIN(session_checkins.checkins) as min_checkins_session
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      LEFT JOIN (
        SELECT session_id, COUNT(*) as checkins
        FROM session_participants
        GROUP BY session_id
      ) session_checkins ON s.id = session_checkins.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
        AND s.net_control_call IS NOT NULL
    `;

    // Get best and worst performing sessions
    const bestSession = await db.sql`
      SELECT 
        s.session_date,
        s.net_control_call,
        s.net_control_name,
        COUNT(sp.id) as checkins
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
        AND s.net_control_call IS NOT NULL
      GROUP BY s.id, s.session_date, s.net_control_call, s.net_control_name
      ORDER BY checkins DESC
      LIMIT 1
    `;

    const worstSession = await db.sql`
      SELECT 
        s.session_date,
        s.net_control_call,
        s.net_control_name,
        COUNT(sp.id) as checkins
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
        AND s.net_control_call IS NOT NULL
      GROUP BY s.id, s.session_date, s.net_control_call, s.net_control_name
      ORDER BY checkins ASC
      LIMIT 1
    `;

    res.json({
      report: {
        period: {
          start_date,
          end_date
        },
        controller_summary: controllerSummary,
        controller_details: controllerDetails,
        chronological_list: chronologicalList,
        statistics: {
          ...stats[0],
          best_session: bestSession[0] || null,
          worst_session: worstSession[0] || null
        }
      }
    });
  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


// Session Summary Report
router.get('/session-summary', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Get summary statistics
    const summary = await db.sql`
      SELECT 
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(sp.id) as total_participants,
        ROUND(AVG(participant_counts.count), 2) as avg_participants,
        COUNT(st.id) as total_traffic
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      LEFT JOIN session_traffic st ON s.id = st.session_id
      LEFT JOIN (
        SELECT session_id, COUNT(*) as count
        FROM session_participants
        GROUP BY session_id
      ) participant_counts ON s.id = participant_counts.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
    `;

    // Get individual sessions
    const sessions = await db.sql`
      SELECT 
        s.id,
        s.session_date,
        s.net_control_call,
        s.net_control_name,
        s.frequency,
        s.mode,
        s.start_time,
        s.end_time,
        COUNT(DISTINCT sp.id) as participant_count,
        COUNT(DISTINCT st.id) as traffic_count
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      LEFT JOIN session_traffic st ON s.id = st.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
      GROUP BY s.id
      ORDER BY s.session_date DESC
    `;

    res.json({
      summary: summary[0],
      sessions
    });
  } catch (error) {
    console.error('Session summary report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Participant Statistics Report
router.get('/participant-stats', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Get top participants
    const topParticipants = await db.sql`
      SELECT 
        sp.call_sign,
        sp.name,
        COUNT(DISTINCT sp.session_id) as session_count,
        ROUND(
          (COUNT(DISTINCT sp.session_id)::numeric / 
          (SELECT COUNT(DISTINCT id) FROM sessions WHERE session_date >= ${start_date} AND session_date <= ${end_date})) * 100,
          1
        ) as participation_rate
      FROM session_participants sp
      JOIN sessions s ON sp.session_id = s.id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
      GROUP BY sp.call_sign, sp.name
      ORDER BY session_count DESC
      LIMIT 20
    `;

    // Get participation trends
    const trends = await db.sql`
      SELECT 
        COUNT(DISTINCT sp.call_sign) as unique_participants,
        COUNT(DISTINCT CASE 
          WHEN first_session.first_date >= ${start_date} 
          THEN sp.call_sign 
        END) as new_participants,
        COUNT(DISTINCT CASE 
          WHEN first_session.first_date < ${start_date} 
          THEN sp.call_sign 
        END) as returning_participants
      FROM session_participants sp
      JOIN sessions s ON sp.session_id = s.id
      LEFT JOIN (
        SELECT 
          sp2.call_sign,
          MIN(s2.session_date) as first_date
        FROM session_participants sp2
        JOIN sessions s2 ON sp2.session_id = s2.id
        GROUP BY sp2.call_sign
      ) first_session ON sp.call_sign = first_session.call_sign
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
    `;

    res.json({
      top_participants: topParticipants,
      trends: trends[0]
    });
  } catch (error) {
    console.error('Participant stats report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Operator Activity Report
router.get('/operator-activity', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Get individual operator statistics
    const operatorStats = await db.sql`
      SELECT 
        sp.call_sign,
        sp.name,
        COUNT(DISTINCT sp.session_id) as total_sessions,
        MIN(s.session_date) as first_session,
        MAX(s.session_date) as last_session,
        ROUND(
          (COUNT(DISTINCT sp.session_id)::numeric / 
          (SELECT COUNT(DISTINCT id) FROM sessions WHERE session_date >= ${start_date} AND session_date <= ${end_date})) * 100,
          1
        ) as participation_rate,
        STRING_AGG(DISTINCT sp.location, ', ') as locations
      FROM session_participants sp
      JOIN sessions s ON sp.session_id = s.id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
      GROUP BY sp.call_sign, sp.name
      ORDER BY total_sessions DESC, sp.call_sign ASC
    `;

    // Get activity by operator over time (sessions per week)
    const activityTimeline = await db.sql`
      SELECT 
        sp.call_sign,
        DATE_TRUNC('week', s.session_date) as week_start,
        COUNT(DISTINCT sp.session_id) as sessions_count
      FROM session_participants sp
      JOIN sessions s ON sp.session_id = s.id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
      GROUP BY sp.call_sign, DATE_TRUNC('week', s.session_date)
      ORDER BY week_start ASC, sp.call_sign ASC
    `;

    // Get consistency metrics (operators who checked in regularly)
    const consistencyMetrics = await db.sql`
      WITH weekly_participation AS (
        SELECT 
          sp.call_sign,
          DATE_TRUNC('week', s.session_date) as week_start,
          COUNT(DISTINCT sp.session_id) as sessions_count
        FROM session_participants sp
        JOIN sessions s ON sp.session_id = s.id
        WHERE s.session_date >= ${start_date}
          AND s.session_date <= ${end_date}
        GROUP BY sp.call_sign, DATE_TRUNC('week', s.session_date)
      ),
      total_weeks AS (
        SELECT COUNT(DISTINCT DATE_TRUNC('week', session_date)) as week_count
        FROM sessions
        WHERE session_date >= ${start_date}
          AND session_date <= ${end_date}
      )
      SELECT 
        wp.call_sign,
        COUNT(DISTINCT wp.week_start) as weeks_active,
        tw.week_count as total_weeks,
        ROUND((COUNT(DISTINCT wp.week_start)::numeric / tw.week_count) * 100, 1) as consistency_rate
      FROM weekly_participation wp
      CROSS JOIN total_weeks tw
      GROUP BY wp.call_sign, tw.week_count
      HAVING COUNT(DISTINCT wp.week_start) >= 2
      ORDER BY consistency_rate DESC, wp.call_sign ASC
      LIMIT 20
    `;

    // Get new vs returning operators
    const operatorCategories = await db.sql`
      WITH first_appearances AS (
        SELECT 
          sp.call_sign,
          MIN(s.session_date) as first_date
        FROM session_participants sp
        JOIN sessions s ON sp.session_id = s.id
        GROUP BY sp.call_sign
      )
      SELECT 
        COUNT(DISTINCT CASE WHEN fa.first_date >= ${start_date} THEN sp.call_sign END) as new_operators,
        COUNT(DISTINCT CASE WHEN fa.first_date < ${start_date} THEN sp.call_sign END) as returning_operators,
        COUNT(DISTINCT sp.call_sign) as total_unique_operators
      FROM session_participants sp
      JOIN sessions s ON sp.session_id = s.id
      LEFT JOIN first_appearances fa ON sp.call_sign = fa.call_sign
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
    `;

    res.json({
      operator_stats: operatorStats,
      activity_timeline: activityTimeline,
      consistency_metrics: consistencyMetrics,
      categories: operatorCategories[0]
    });
  } catch (error) {
    console.error('Operator activity report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Geographic Distribution Report
router.get('/geographic-distribution', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Get participation by location
    const locationStats = await db.sql`
      SELECT 
        COALESCE(NULLIF(TRIM(sp.location), ''), 'Unknown') as location,
        COUNT(DISTINCT sp.call_sign) as unique_operators,
        COUNT(sp.id) as total_checkins,
        ROUND(AVG(CASE WHEN sp.location IS NOT NULL AND sp.location != '' THEN 1 ELSE 0 END) * 100, 1) as location_reporting_rate
      FROM session_participants sp
      JOIN sessions s ON sp.session_id = s.id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
      GROUP BY COALESCE(NULLIF(TRIM(sp.location), ''), 'Unknown')
      ORDER BY total_checkins DESC
    `;

    // Get operators by location
    const operatorsByLocation = await db.sql`
      SELECT 
        COALESCE(NULLIF(TRIM(sp.location), ''), 'Unknown') as location,
        sp.call_sign,
        sp.name,
        COUNT(sp.id) as checkin_count
      FROM session_participants sp
      JOIN sessions s ON sp.session_id = s.id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
      GROUP BY COALESCE(NULLIF(TRIM(sp.location), ''), 'Unknown'), sp.call_sign, sp.name
      ORDER BY location ASC, checkin_count DESC
    `;

    // Get geographic coverage statistics
    const coverageStats = await db.sql`
      SELECT 
        COUNT(DISTINCT CASE WHEN sp.location IS NOT NULL AND sp.location != '' THEN sp.location END) as unique_locations,
        COUNT(DISTINCT sp.call_sign) as total_operators,
        COUNT(DISTINCT CASE WHEN sp.location IS NULL OR sp.location = '' THEN sp.call_sign END) as operators_without_location,
        ROUND(
          (COUNT(DISTINCT CASE WHEN sp.location IS NOT NULL AND sp.location != '' THEN sp.call_sign END)::numeric / 
          COUNT(DISTINCT sp.call_sign)) * 100,
          1
        ) as location_coverage_rate
      FROM session_participants sp
      JOIN sessions s ON sp.session_id = s.id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
    `;

    // Get location diversity by session
    const sessionDiversity = await db.sql`
      SELECT 
        s.session_date,
        s.net_control_call,
        COUNT(DISTINCT CASE WHEN sp.location IS NOT NULL AND sp.location != '' THEN sp.location END) as unique_locations,
        COUNT(DISTINCT sp.call_sign) as total_participants
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
      GROUP BY s.id, s.session_date, s.net_control_call
      ORDER BY s.session_date DESC
    `;

    res.json({
      location_stats: locationStats,
      operators_by_location: operatorsByLocation,
      coverage_stats: coverageStats[0],
      session_diversity: sessionDiversity
    });
  } catch (error) {
    console.error('Geographic distribution report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Net Controller Contact Details Report
router.get('/net-controller-contacts', authenticateToken, async (req, res) => {
  try {
    // Get all users who have been net controllers
    const netControllers = await db.sql`
      SELECT DISTINCT
        u.call_sign,
        u.name,
        u.email,
        u.phone_number,
        COUNT(DISTINCT s.id) as sessions_controlled
      FROM users u
      INNER JOIN sessions s ON UPPER(u.call_sign) = UPPER(s.net_control_call)
      WHERE u.call_sign IS NOT NULL
      GROUP BY u.id, u.call_sign, u.name, u.email, u.phone_number
      ORDER BY u.call_sign ASC
    `;

    res.json({
      net_controllers: netControllers,
      total_count: netControllers.length
    });
  } catch (error) {
    console.error('Net controller contacts report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Traffic Report
router.get('/traffic-report', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Get overall traffic statistics
    const trafficStats = await db.sql`
      SELECT 
        COUNT(st.id) as total_messages,
        COUNT(DISTINCT st.session_id) as sessions_with_traffic,
        COUNT(DISTINCT s.id) as total_sessions,
        ROUND(AVG(message_counts.count), 2) as avg_messages_per_session,
        MAX(message_counts.count) as max_messages_session,
        COUNT(DISTINCT st.from_call) as unique_originators,
        COUNT(DISTINCT st.to_call) as unique_recipients
      FROM sessions s
      LEFT JOIN session_traffic st ON s.id = st.session_id
      LEFT JOIN (
        SELECT session_id, COUNT(*) as count
        FROM session_traffic
        GROUP BY session_id
      ) message_counts ON s.id = message_counts.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
    `;

    // Get traffic by session
    const trafficBySession = await db.sql`
      SELECT 
        s.session_date,
        s.net_control_call,
        s.net_control_name,
        COUNT(st.id) as message_count,
        COUNT(DISTINCT st.from_call) as unique_senders,
        COUNT(DISTINCT st.to_call) as unique_recipients
      FROM sessions s
      LEFT JOIN session_traffic st ON s.id = st.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
      GROUP BY s.id, s.session_date, s.net_control_call, s.net_control_name
      HAVING COUNT(st.id) > 0
      ORDER BY s.session_date DESC
    `;

    // Get traffic by type/priority
    const trafficByType = await db.sql`
      SELECT 
        COALESCE(st.priority, 'Normal') as priority,
        COUNT(st.id) as message_count,
        ROUND((COUNT(st.id)::numeric / NULLIF((SELECT COUNT(*) FROM session_traffic st2 
          JOIN sessions s2 ON st2.session_id = s2.id 
          WHERE s2.session_date >= ${start_date} AND s2.session_date <= ${end_date}), 0)) * 100, 1) as percentage
      FROM session_traffic st
      JOIN sessions s ON st.session_id = s.id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
      GROUP BY COALESCE(st.priority, 'Normal')
      ORDER BY message_count DESC
    `;

    // Get most active message originators
    const topOriginators = await db.sql`
      SELECT 
        st.from_call,
        st.from_name,
        COUNT(st.id) as messages_sent,
        COUNT(DISTINCT st.session_id) as sessions_active
      FROM session_traffic st
      JOIN sessions s ON st.session_id = s.id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
        AND st.from_call IS NOT NULL
      GROUP BY st.from_call, st.from_name
      ORDER BY messages_sent DESC
      LIMIT 15
    `;

    // Get most active message recipients
    const topRecipients = await db.sql`
      SELECT 
        st.to_call,
        st.to_name,
        COUNT(st.id) as messages_received,
        COUNT(DISTINCT st.session_id) as sessions_active
      FROM session_traffic st
      JOIN sessions s ON st.session_id = s.id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
        AND st.to_call IS NOT NULL
      GROUP BY st.to_call, st.to_name
      ORDER BY messages_received DESC
      LIMIT 15
    `;

    // Get traffic timeline (messages per day)
    const trafficTimeline = await db.sql`
      SELECT 
        s.session_date,
        COUNT(st.id) as message_count
      FROM sessions s
      LEFT JOIN session_traffic st ON s.id = st.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
      GROUP BY s.session_date
      ORDER BY s.session_date ASC
    `;

    res.json({
      traffic_stats: trafficStats[0],
      traffic_by_session: trafficBySession,
      traffic_by_type: trafficByType,
      top_originators: topOriginators,
      top_recipients: topRecipients,
      traffic_timeline: trafficTimeline
    });
  } catch (error) {
    console.error('Traffic report error:', error);
    res.status(500).json({ error: error.message });
  }
});
