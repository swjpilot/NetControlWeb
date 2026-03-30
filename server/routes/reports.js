const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const { authenticateToken, requireAdmin } = require('./auth-postgres-js');

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
        SUM(GREATEST(sub.actual_checkins, COALESCE(s.total_checkins, 0))) as total_checkins
      FROM sessions s
      LEFT JOIN (
        SELECT session_id, COUNT(*) as actual_checkins
        FROM session_participants
        GROUP BY session_id
      ) sub ON s.id = sub.session_id
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
        GREATEST(COUNT(sp.id), COALESCE(s.total_checkins, 0)) as checkins
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
        AND s.net_control_call IS NOT NULL
      GROUP BY s.id, s.net_control_call, s.net_control_name, s.session_date, s.total_checkins
      ORDER BY s.net_control_call ASC, s.session_date ASC
    `;

    // 3. Get chronological list (by date)
    const chronologicalList = await db.sql`
      SELECT 
        s.session_date,
        s.net_control_call,
        s.net_control_name,
        s.id as session_id,
        GREATEST(COUNT(sp.id), COALESCE(s.total_checkins, 0)) as checkins
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
        AND s.net_control_call IS NOT NULL
      GROUP BY s.id, s.session_date, s.net_control_call, s.net_control_name, s.total_checkins
      ORDER BY s.session_date ASC
    `;

    // 4. Calculate statistics
    const stats = await db.sql`
      SELECT 
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(DISTINCT s.net_control_call) as unique_controllers,
        SUM(GREATEST(COALESCE(session_checkins.checkins, 0), COALESCE(s.total_checkins, 0))) as total_checkins,
        ROUND(AVG(GREATEST(COALESCE(session_checkins.checkins, 0), COALESCE(s.total_checkins, 0))), 2) as avg_checkins_per_session,
        MAX(GREATEST(COALESCE(session_checkins.checkins, 0), COALESCE(s.total_checkins, 0))) as max_checkins_session,
        MIN(GREATEST(COALESCE(session_checkins.checkins, 0), COALESCE(s.total_checkins, 0))) as min_checkins_session
      FROM sessions s
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
        GREATEST(COUNT(sp.id), COALESCE(s.total_checkins, 0)) as checkins
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
        AND s.net_control_call IS NOT NULL
      GROUP BY s.id, s.session_date, s.net_control_call, s.net_control_name, s.total_checkins
      ORDER BY checkins DESC
      LIMIT 1
    `;

    const worstSession = await db.sql`
      SELECT 
        s.session_date,
        s.net_control_call,
        s.net_control_name,
        GREATEST(COUNT(sp.id), COALESCE(s.total_checkins, 0)) as checkins
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
        AND s.net_control_call IS NOT NULL
      GROUP BY s.id, s.session_date, s.net_control_call, s.net_control_name, s.total_checkins
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

// Send monthly net report email (admin only)
// Shared function to send monthly net report email
async function sendMonthlyReportEmail({ recipientEmail, callerCallSign, callerEmail }) {
  // Get net name from settings
  const nameSetting = await db.sql`SELECT value FROM settings WHERE key = 'app_name'`;
  const netName = nameSetting[0]?.value || 'NetControl';

  // Calculate previous month date range
  const now = new Date();
  const firstOfThisMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const firstOfLastMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
  const lastOfLastMonth = new Date(firstOfThisMonth - 1);

  const startDate = firstOfLastMonth.toISOString().split('T')[0];
  const endDate = lastOfLastMonth.toISOString().split('T')[0];

  // Query stats for last month
  const statsResult = await db.sql`
    SELECT 
      COUNT(*) as total_nets,
      COALESCE(SUM(GREATEST(
        (SELECT COUNT(*) FROM session_participants sp WHERE sp.session_id = s.id),
        COALESCE(s.total_checkins, 0)
      )), 0) as total_checkins,
      COALESCE(SUM(GREATEST(
        (SELECT COUNT(*) FROM session_traffic st WHERE st.session_id = s.id),
        COALESCE(s.total_traffic, 0)
      )), 0) as total_traffic
    FROM sessions s
    WHERE s.session_date >= ${startDate} AND s.session_date <= ${endDate}
  `;

  const stats = statsResult[0];
  const totalNets = parseInt(stats.total_nets) || 0;
  const totalCheckins = parseInt(stats.total_checkins) || 0;
  const totalTraffic = parseInt(stats.total_traffic) || 0;

  const monthName = firstOfLastMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const subject = netName + ' Monthly Net Report';
  const body = [netName, totalCheckins, totalTraffic, totalNets, callerCallSign].join('/');

  // Get SMTP settings
  const smtpSettings = await db.sql`
    SELECT key, value FROM settings
    WHERE key IN ('smtp_host', 'smtp_port', 'smtp_secure', 'smtp_starttls', 'smtp_no_auth', 'smtp_username', 'smtp_password', 'smtp_from_email', 'smtp_from_name')
  `;
  const smtp = {};
  smtpSettings.forEach(s => { smtp[s.key] = s.value; });

  if (!smtp.smtp_host || !smtp.smtp_port) {
    throw new Error('SMTP settings not configured');
  }

  const nodemailer = require('nodemailer');
  const transportConfig = {
    host: smtp.smtp_host,
    port: parseInt(smtp.smtp_port),
    secure: smtp.smtp_secure === 'true',
    requireTLS: smtp.smtp_starttls === 'true'
  };
  if (smtp.smtp_no_auth !== 'true') {
    transportConfig.auth = { user: smtp.smtp_username, pass: smtp.smtp_password };
  }

  const transporter = nodemailer.createTransport(transportConfig);
  const toEmail = recipientEmail || smtp.smtp_from_email || smtp.smtp_username;

  await transporter.sendMail({
    from: (smtp.smtp_from_name || 'NetControl') + ' <' + (smtp.smtp_from_email || smtp.smtp_username) + '>',
    replyTo: callerEmail || smtp.smtp_from_email || smtp.smtp_username,
    to: toEmail,
    subject: subject,
    text: body
  });

  return { toEmail, subject, body, monthName, totalNets, totalCheckins, totalTraffic, callSign: callerCallSign };
}

// Manual send endpoint (admin only)
router.post('/send-monthly-email', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { recipient_email } = req.body;

    const userResult = await db.sql`
      SELECT call_sign, email FROM users WHERE id = ${req.user.userId}
    `;
    const userCallSign = (userResult[0]?.call_sign || '').toUpperCase();
    const userEmail = userResult[0]?.email || '';

    if (!userCallSign) {
      return res.status(400).json({ error: 'Your user account does not have a call sign configured' });
    }

    const result = await sendMonthlyReportEmail({
      recipientEmail: recipient_email,
      callerCallSign: userCallSign,
      callerEmail: userEmail
    });

    res.json({
      success: true,
      message: 'Monthly report email sent to ' + result.toEmail,
      data: result
    });

  } catch (error) {
    console.error('Send monthly report email error:', error);
    res.status(500).json({ error: 'Failed to send report email: ' + error.message });
  }
});

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
        SUM(GREATEST(COALESCE(pc.count, 0), COALESCE(s.total_checkins, 0))) as total_participants,
        ROUND(AVG(GREATEST(COALESCE(pc.count, 0), COALESCE(s.total_checkins, 0))), 2) as avg_participants,
        SUM(GREATEST(COALESCE(tc.count, 0), COALESCE(s.total_traffic, 0))) as total_traffic
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
        GREATEST(COUNT(DISTINCT sp.id), COALESCE(s.total_checkins, 0)) as participant_count,
        GREATEST(COUNT(DISTINCT st.id), COALESCE(s.total_traffic, 0)) as traffic_count
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      LEFT JOIN session_traffic st ON s.id = st.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
      GROUP BY s.id, s.total_checkins, s.total_traffic
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
        GREATEST(COUNT(DISTINCT sp.call_sign), COALESCE(s.total_checkins, 0)) as total_participants
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
      GROUP BY s.id, s.session_date, s.net_control_call, s.total_checkins
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
        SUM(GREATEST(COALESCE(mc.count, 0), COALESCE(s.total_traffic, 0))) as total_messages,
        COUNT(DISTINCT CASE WHEN mc.count > 0 OR COALESCE(s.total_traffic, 0) > 0 THEN s.id END) as sessions_with_traffic,
        COUNT(DISTINCT s.id) as total_sessions,
        ROUND(AVG(GREATEST(COALESCE(mc.count, 0), COALESCE(s.total_traffic, 0))), 2) as avg_messages_per_session,
        MAX(GREATEST(COALESCE(mc.count, 0), COALESCE(s.total_traffic, 0))) as max_messages_session,
        COUNT(DISTINCT st.from_call) as unique_originators,
        COUNT(DISTINCT st.to_call) as unique_recipients
      FROM sessions s
      LEFT JOIN session_traffic st ON s.id = st.session_id
      LEFT JOIN (
        SELECT session_id, COUNT(*) as count
        FROM session_traffic
        GROUP BY session_id
      ) mc ON s.id = mc.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
    `;

    // Get traffic by session
    const trafficBySession = await db.sql`
      SELECT 
        s.session_date,
        s.net_control_call,
        s.net_control_name,
        GREATEST(COUNT(st.id), COALESCE(s.total_traffic, 0)) as message_count,
        COUNT(DISTINCT st.from_call) as unique_senders,
        COUNT(DISTINCT st.to_call) as unique_recipients
      FROM sessions s
      LEFT JOIN session_traffic st ON s.id = st.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
      GROUP BY s.id, s.session_date, s.net_control_call, s.net_control_name, s.total_traffic
      HAVING COUNT(st.id) > 0 OR COALESCE(s.total_traffic, 0) > 0
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
        GREATEST(COUNT(st.id), COALESCE(s.total_traffic, 0)) as message_count
      FROM sessions s
      LEFT JOIN session_traffic st ON s.id = st.session_id
      WHERE s.session_date >= ${start_date}
        AND s.session_date <= ${end_date}
      GROUP BY s.id, s.session_date, s.total_traffic
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

// Net Controller Statistics Report
router.get('/nc-statistics', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }

    // Per-controller stats
    const controllers = await db.sql`
      SELECT 
        s.net_control_call,
        s.net_control_name,
        COUNT(DISTINCT s.id) as sessions_count,
        SUM(GREATEST(COALESCE(pc.cnt, 0), COALESCE(s.total_checkins, 0))) as total_checkins,
        SUM(GREATEST(COALESCE(tc.cnt, 0), COALESCE(s.total_traffic, 0))) as total_traffic,
        ROUND(AVG(GREATEST(COALESCE(pc.cnt, 0), COALESCE(s.total_checkins, 0))), 1) as avg_checkins,
        MAX(GREATEST(COALESCE(pc.cnt, 0), COALESCE(s.total_checkins, 0))) as max_checkins,
        MIN(s.session_date) as first_session,
        MAX(s.session_date) as last_session
      FROM sessions s
      LEFT JOIN (SELECT session_id, COUNT(*) as cnt FROM session_participants GROUP BY session_id) pc ON s.id = pc.session_id
      LEFT JOIN (SELECT session_id, COUNT(*) as cnt FROM session_traffic GROUP BY session_id) tc ON s.id = tc.session_id
      WHERE s.session_date >= ${start_date} AND s.session_date <= ${end_date}
        AND s.net_control_call IS NOT NULL
      GROUP BY s.net_control_call, s.net_control_name
      ORDER BY sessions_count DESC, total_checkins DESC
    `;

    // Day-of-week breakdown
    const dayOfWeek = await db.sql`
      SELECT 
        s.net_control_call,
        EXTRACT(DOW FROM s.session_date) as dow,
        COUNT(*) as count
      FROM sessions s
      WHERE s.session_date >= ${start_date} AND s.session_date <= ${end_date}
        AND s.net_control_call IS NOT NULL
      GROUP BY s.net_control_call, EXTRACT(DOW FROM s.session_date)
      ORDER BY s.net_control_call, dow
    `;

    // Monthly trend
    const monthlyTrend = await db.sql`
      SELECT 
        TO_CHAR(s.session_date, 'YYYY-MM') as month,
        COUNT(DISTINCT s.id) as sessions,
        COUNT(DISTINCT s.net_control_call) as unique_controllers,
        SUM(GREATEST(COALESCE(pc.cnt, 0), COALESCE(s.total_checkins, 0))) as total_checkins
      FROM sessions s
      LEFT JOIN (SELECT session_id, COUNT(*) as cnt FROM session_participants GROUP BY session_id) pc ON s.id = pc.session_id
      WHERE s.session_date >= ${start_date} AND s.session_date <= ${end_date}
        AND s.net_control_call IS NOT NULL
      GROUP BY TO_CHAR(s.session_date, 'YYYY-MM')
      ORDER BY month
    `;

    // Overall totals
    const totals = await db.sql`
      SELECT 
        COUNT(DISTINCT s.id) as total_sessions,
        COUNT(DISTINCT s.net_control_call) as unique_controllers,
        SUM(GREATEST(COALESCE(pc.cnt, 0), COALESCE(s.total_checkins, 0))) as total_checkins,
        SUM(GREATEST(COALESCE(tc.cnt, 0), COALESCE(s.total_traffic, 0))) as total_traffic,
        ROUND(AVG(GREATEST(COALESCE(pc.cnt, 0), COALESCE(s.total_checkins, 0))), 1) as avg_checkins_per_session
      FROM sessions s
      LEFT JOIN (SELECT session_id, COUNT(*) as cnt FROM session_participants GROUP BY session_id) pc ON s.id = pc.session_id
      LEFT JOIN (SELECT session_id, COUNT(*) as cnt FROM session_traffic GROUP BY session_id) tc ON s.id = tc.session_id
      WHERE s.session_date >= ${start_date} AND s.session_date <= ${end_date}
        AND s.net_control_call IS NOT NULL
    `;

    res.json({
      controllers,
      day_of_week: dayOfWeek,
      monthly_trend: monthlyTrend,
      totals: totals[0],
      period: { start_date, end_date }
    });
  } catch (error) {
    console.error('NC statistics report error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.sendMonthlyReportEmail = sendMonthlyReportEmail;
