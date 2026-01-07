const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken } = require('./auth');
const puppeteer = require('puppeteer');
const xlsx = require('xlsx');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

// Session Summary Report
router.get('/session-summary', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Get summary statistics
    const summary = await db.get(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(participant_count) as total_participants,
        ROUND(AVG(participant_count), 1) as avg_participants,
        SUM(traffic_count) as total_traffic
      FROM (
        SELECT 
          s.id,
          COUNT(DISTINCT sp.id) as participant_count,
          COUNT(DISTINCT st.id) as traffic_count
        FROM sessions s
        LEFT JOIN session_participants sp ON s.id = sp.session_id
        LEFT JOIN session_traffic st ON s.id = st.session_id
        WHERE s.session_date BETWEEN ? AND ?
        GROUP BY s.id
      )
    `, [start_date, end_date]);
    
    // Get detailed sessions
    const sessions = await db.all(`
      SELECT 
        s.*,
        COUNT(DISTINCT sp.id) as participant_count,
        COUNT(DISTINCT st.id) as traffic_count
      FROM sessions s
      LEFT JOIN session_participants sp ON s.id = sp.session_id
      LEFT JOIN session_traffic st ON s.id = st.session_id
      WHERE s.session_date BETWEEN ? AND ?
      GROUP BY s.id
      ORDER BY s.session_date DESC
    `, [start_date, end_date]);
    
    res.json({
      summary,
      sessions
    });
  } catch (error) {
    console.error('Error generating session summary report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Participant Statistics Report
router.get('/participant-stats', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Get total sessions in date range for participation rate calculation
    const totalSessions = await db.get(`
      SELECT COUNT(*) as count 
      FROM sessions 
      WHERE session_date BETWEEN ? AND ?
    `, [start_date, end_date]);
    
    // Get top participants
    const topParticipants = await db.all(`
      SELECT 
        COALESCE(o.call_sign, sp.call_sign) as call_sign,
        o.name,
        COUNT(DISTINCT sp.session_id) as session_count,
        ROUND((COUNT(DISTINCT sp.session_id) * 100.0 / ?), 1) as participation_rate
      FROM session_participants sp
      LEFT JOIN operators o ON sp.operator_id = o.id
      INNER JOIN sessions s ON sp.session_id = s.id
      WHERE s.session_date BETWEEN ? AND ?
      GROUP BY COALESCE(o.call_sign, sp.call_sign), o.name
      ORDER BY session_count DESC
      LIMIT 20
    `, [totalSessions.count, start_date, end_date]);
    
    // Get participation trends
    const uniqueParticipants = await db.get(`
      SELECT COUNT(DISTINCT COALESCE(o.call_sign, sp.call_sign)) as count
      FROM session_participants sp
      LEFT JOIN operators o ON sp.operator_id = o.id
      INNER JOIN sessions s ON sp.session_id = s.id
      WHERE s.session_date BETWEEN ? AND ?
    `, [start_date, end_date]);
    
    // Get new vs returning participants (simplified)
    const newParticipants = await db.get(`
      SELECT COUNT(DISTINCT COALESCE(o.call_sign, sp.call_sign)) as count
      FROM session_participants sp
      LEFT JOIN operators o ON sp.operator_id = o.id
      INNER JOIN sessions s ON sp.session_id = s.id
      WHERE s.session_date BETWEEN ? AND ?
      AND NOT EXISTS (
        SELECT 1 FROM session_participants sp2
        LEFT JOIN operators o2 ON sp2.operator_id = o2.id
        INNER JOIN sessions s2 ON sp2.session_id = s2.id
        WHERE COALESCE(o2.call_sign, sp2.call_sign) = COALESCE(o.call_sign, sp.call_sign)
        AND s2.session_date < ?
      )
    `, [start_date, end_date, start_date]);
    
    const trends = {
      unique_participants: uniqueParticipants.count,
      new_participants: newParticipants.count,
      returning_participants: uniqueParticipants.count - newParticipants.count
    };
    
    res.json({
      top_participants: topParticipants,
      trends
    });
  } catch (error) {
    console.error('Error generating participant stats report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Operator Activity Report
router.get('/operator-activity', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const operators = await db.all(`
      SELECT 
        o.call_sign,
        o.name,
        o.location,
        o.class,
        COUNT(DISTINCT sp.session_id) as sessions_participated,
        COUNT(DISTINCT CASE WHEN st.from_operator_id = o.id THEN st.id END) as messages_sent,
        COUNT(DISTINCT CASE WHEN st.to_operator_id = o.id THEN st.id END) as messages_received,
        MIN(s.session_date) as first_participation,
        MAX(s.session_date) as last_participation
      FROM operators o
      LEFT JOIN session_participants sp ON o.id = sp.operator_id
      LEFT JOIN sessions s ON sp.session_id = s.id AND s.session_date BETWEEN ? AND ?
      LEFT JOIN session_traffic st ON (st.from_operator_id = o.id OR st.to_operator_id = o.id)
      WHERE sp.id IS NOT NULL
      GROUP BY o.id, o.call_sign, o.name, o.location, o.class
      ORDER BY sessions_participated DESC, o.call_sign
    `, [start_date, end_date]);
    
    res.json({ operators });
  } catch (error) {
    console.error('Error generating operator activity report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Geographic Distribution Report
router.get('/geographic-distribution', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const locations = await db.all(`
      SELECT 
        o.location,
        COUNT(DISTINCT o.id) as unique_operators,
        COUNT(DISTINCT sp.session_id) as total_participations
      FROM operators o
      INNER JOIN session_participants sp ON o.id = sp.operator_id
      INNER JOIN sessions s ON sp.session_id = s.id
      WHERE s.session_date BETWEEN ? AND ?
      AND o.location IS NOT NULL AND o.location != ''
      GROUP BY o.location
      ORDER BY total_participations DESC
    `, [start_date, end_date]);
    
    res.json({ locations });
  } catch (error) {
    console.error('Error generating geographic distribution report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Traffic Report
router.get('/traffic-report', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const trafficSummary = await db.get(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN message_type = 'Emergency' THEN 1 END) as emergency_messages,
        COUNT(CASE WHEN message_type = 'Priority' THEN 1 END) as priority_messages,
        COUNT(CASE WHEN message_type = 'Welfare' THEN 1 END) as welfare_messages,
        COUNT(CASE WHEN message_type = 'Routine' THEN 1 END) as routine_messages
      FROM session_traffic st
      INNER JOIN sessions s ON st.session_id = s.id
      WHERE s.session_date BETWEEN ? AND ?
    `, [start_date, end_date]);
    
    const trafficBySession = await db.all(`
      SELECT 
        s.session_date,
        s.net_control_call,
        COUNT(st.id) as message_count,
        COUNT(CASE WHEN st.message_type = 'Emergency' THEN 1 END) as emergency_count,
        COUNT(CASE WHEN st.message_type = 'Priority' THEN 1 END) as priority_count
      FROM sessions s
      LEFT JOIN session_traffic st ON s.id = st.session_id
      WHERE s.session_date BETWEEN ? AND ?
      GROUP BY s.id, s.session_date, s.net_control_call
      ORDER BY s.session_date DESC
    `, [start_date, end_date]);
    
    res.json({
      summary: trafficSummary,
      by_session: trafficBySession
    });
  } catch (error) {
    console.error('Error generating traffic report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Net Control Report
router.get('/net-control-report', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const netControlStats = await db.all(`
      SELECT 
        s.net_control_call,
        s.net_control_name,
        COUNT(*) as sessions_controlled,
        SUM(participant_counts.participant_count) as total_participants_managed,
        ROUND(AVG(participant_counts.participant_count), 1) as avg_participants_per_session,
        SUM(traffic_counts.traffic_count) as total_traffic_handled
      FROM sessions s
      LEFT JOIN (
        SELECT session_id, COUNT(*) as participant_count
        FROM session_participants
        GROUP BY session_id
      ) participant_counts ON s.id = participant_counts.session_id
      LEFT JOIN (
        SELECT session_id, COUNT(*) as traffic_count
        FROM session_traffic
        GROUP BY session_id
      ) traffic_counts ON s.id = traffic_counts.session_id
      WHERE s.session_date BETWEEN ? AND ?
      GROUP BY s.net_control_call, s.net_control_name
      ORDER BY sessions_controlled DESC, s.net_control_call
    `, [start_date, end_date]);
    
    res.json({ net_control_stats: netControlStats });
  } catch (error) {
    console.error('Error generating net control report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Helper function to get report data
async function getReportData(reportType, startDate, endDate) {
  switch (reportType) {
    case 'session-summary':
      return await getSessionSummaryData(startDate, endDate);
    case 'participant-stats':
      return await getParticipantStatsData(startDate, endDate);
    case 'operator-activity':
      return await getOperatorActivityData(startDate, endDate);
    case 'geographic-distribution':
      return await getGeographicDistributionData(startDate, endDate);
    case 'traffic-report':
      return await getTrafficReportData(startDate, endDate);
    case 'net-control-report':
      return await getNetControlReportData(startDate, endDate);
    default:
      throw new Error('Invalid report type');
  }
}

async function getSessionSummaryData(startDate, endDate) {
  const sessions = await db.all(`
    SELECT 
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
    WHERE s.session_date BETWEEN ? AND ?
    GROUP BY s.id
    ORDER BY s.session_date DESC
  `, [startDate, endDate]);
  
  return sessions.map(session => ({
    'Date': new Date(session.session_date).toLocaleDateString(),
    'Net Control Call': session.net_control_call,
    'Net Control Name': session.net_control_name || '',
    'Frequency': session.frequency || '',
    'Mode': session.mode || '',
    'Start Time': session.start_time || '',
    'End Time': session.end_time || '',
    'Participants': session.participant_count,
    'Traffic': session.traffic_count
  }));
}

async function getParticipantStatsData(startDate, endDate) {
  const totalSessions = await db.get(`
    SELECT COUNT(*) as count FROM sessions WHERE session_date BETWEEN ? AND ?
  `, [startDate, endDate]);
  
  const participants = await db.all(`
    SELECT 
      COALESCE(o.call_sign, sp.call_sign) as call_sign,
      o.name,
      o.location,
      COUNT(DISTINCT sp.session_id) as session_count,
      ROUND((COUNT(DISTINCT sp.session_id) * 100.0 / ?), 1) as participation_rate
    FROM session_participants sp
    LEFT JOIN operators o ON sp.operator_id = o.id
    INNER JOIN sessions s ON sp.session_id = s.id
    WHERE s.session_date BETWEEN ? AND ?
    GROUP BY COALESCE(o.call_sign, sp.call_sign), o.name, o.location
    ORDER BY session_count DESC
  `, [totalSessions.count, startDate, endDate]);
  
  return participants.map(p => ({
    'Call Sign': p.call_sign,
    'Name': p.name || '',
    'Location': p.location || '',
    'Sessions': p.session_count,
    'Participation Rate (%)': p.participation_rate
  }));
}

async function getOperatorActivityData(startDate, endDate) {
  const operators = await db.all(`
    SELECT 
      o.call_sign,
      o.name,
      o.location,
      o.class,
      COUNT(DISTINCT sp.session_id) as sessions_participated,
      COUNT(DISTINCT CASE WHEN st.from_operator_id = o.id THEN st.id END) as messages_sent,
      COUNT(DISTINCT CASE WHEN st.to_operator_id = o.id THEN st.id END) as messages_received,
      MIN(s.session_date) as first_participation,
      MAX(s.session_date) as last_participation
    FROM operators o
    LEFT JOIN session_participants sp ON o.id = sp.operator_id
    LEFT JOIN sessions s ON sp.session_id = s.id AND s.session_date BETWEEN ? AND ?
    LEFT JOIN session_traffic st ON (st.from_operator_id = o.id OR st.to_operator_id = o.id)
    WHERE sp.id IS NOT NULL
    GROUP BY o.id, o.call_sign, o.name, o.location, o.class
    ORDER BY sessions_participated DESC, o.call_sign
  `, [startDate, endDate]);
  
  return operators.map(op => ({
    'Call Sign': op.call_sign,
    'Name': op.name || '',
    'Location': op.location || '',
    'License Class': op.class || '',
    'Sessions': op.sessions_participated,
    'Messages Sent': op.messages_sent,
    'Messages Received': op.messages_received,
    'First Participation': op.first_participation ? new Date(op.first_participation).toLocaleDateString() : '',
    'Last Participation': op.last_participation ? new Date(op.last_participation).toLocaleDateString() : ''
  }));
}

async function getGeographicDistributionData(startDate, endDate) {
  const locations = await db.all(`
    SELECT 
      o.location,
      COUNT(DISTINCT o.id) as unique_operators,
      COUNT(DISTINCT sp.session_id) as total_participations
    FROM operators o
    INNER JOIN session_participants sp ON o.id = sp.operator_id
    INNER JOIN sessions s ON sp.session_id = s.id
    WHERE s.session_date BETWEEN ? AND ?
    AND o.location IS NOT NULL AND o.location != ''
    GROUP BY o.location
    ORDER BY total_participations DESC
  `, [startDate, endDate]);
  
  return locations.map(loc => ({
    'Location': loc.location,
    'Unique Operators': loc.unique_operators,
    'Total Participations': loc.total_participations
  }));
}

async function getTrafficReportData(startDate, endDate) {
  const traffic = await db.all(`
    SELECT 
      s.session_date,
      s.net_control_call,
      COALESCE(o_from.call_sign, st.from_call) as from_call,
      COALESCE(o_to.call_sign, st.to_call) as to_call,
      st.message_type,
      st.precedence,
      st.message_content,
      st.created_at
    FROM session_traffic st
    INNER JOIN sessions s ON st.session_id = s.id
    LEFT JOIN operators o_from ON st.from_operator_id = o_from.id
    LEFT JOIN operators o_to ON st.to_operator_id = o_to.id
    WHERE s.session_date BETWEEN ? AND ?
    ORDER BY s.session_date DESC, st.created_at DESC
  `, [startDate, endDate]);
  
  return traffic.map(t => ({
    'Date': new Date(t.session_date).toLocaleDateString(),
    'Net Control': t.net_control_call,
    'From': t.from_call || '',
    'To': t.to_call || '',
    'Type': t.message_type,
    'Precedence': t.precedence,
    'Message': t.message_content || '',
    'Time': new Date(t.created_at).toLocaleTimeString()
  }));
}

async function getNetControlReportData(startDate, endDate) {
  const netControls = await db.all(`
    SELECT 
      s.net_control_call,
      s.net_control_name,
      COUNT(*) as sessions_controlled,
      SUM(participant_counts.participant_count) as total_participants_managed,
      ROUND(AVG(participant_counts.participant_count), 1) as avg_participants_per_session,
      SUM(traffic_counts.traffic_count) as total_traffic_handled
    FROM sessions s
    LEFT JOIN (
      SELECT session_id, COUNT(*) as participant_count
      FROM session_participants
      GROUP BY session_id
    ) participant_counts ON s.id = participant_counts.session_id
    LEFT JOIN (
      SELECT session_id, COUNT(*) as traffic_count
      FROM session_traffic
      GROUP BY session_id
    ) traffic_counts ON s.id = traffic_counts.session_id
    WHERE s.session_date BETWEEN ? AND ?
    GROUP BY s.net_control_call, s.net_control_name
    ORDER BY sessions_controlled DESC, s.net_control_call
  `, [startDate, endDate]);
  
  return netControls.map(nc => ({
    'Net Control Call': nc.net_control_call,
    'Net Control Name': nc.net_control_name || '',
    'Sessions Controlled': nc.sessions_controlled,
    'Total Participants': nc.total_participants_managed || 0,
    'Avg Participants': nc.avg_participants_per_session || 0,
    'Traffic Handled': nc.total_traffic_handled || 0
  }));
}

// Export endpoints
router.get('/:reportType/export', authenticateToken, async (req, res) => {
  try {
    const { reportType } = req.params;
    const { format, start_date, end_date } = req.query;
    
    if (!['pdf', 'csv', 'xlsx'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Use pdf, csv, or xlsx' });
    }
    
    const reportData = await getReportData(reportType, start_date, end_date);
    const reportTitle = getReportTitle(reportType);
    const filename = `${reportType}_${start_date}_to_${end_date}`;
    
    switch (format) {
      case 'csv':
        await exportCSV(res, reportData, filename);
        break;
      case 'xlsx':
        await exportExcel(res, reportData, filename, reportTitle);
        break;
      case 'pdf':
        await exportPDF(res, reportData, filename, reportTitle, start_date, end_date);
        break;
    }
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

function getReportTitle(reportType) {
  const titles = {
    'session-summary': 'Session Summary Report',
    'participant-stats': 'Participant Statistics Report',
    'operator-activity': 'Operator Activity Report',
    'geographic-distribution': 'Geographic Distribution Report',
    'traffic-report': 'Traffic Report',
    'net-control-report': 'Net Control Report'
  };
  return titles[reportType] || 'Report';
}

async function exportCSV(res, data, filename) {
  if (data.length === 0) {
    return res.status(400).json({ error: 'No data to export' });
  }
  
  const tempPath = path.join(__dirname, '../downloads', `${filename}.csv`);
  
  const csvWriter = createCsvWriter({
    path: tempPath,
    header: Object.keys(data[0]).map(key => ({ id: key, title: key }))
  });
  
  await csvWriter.writeRecords(data);
  
  res.download(tempPath, `${filename}.csv`, (err) => {
    if (err) {
      console.error('Error downloading CSV:', err);
    }
    // Clean up temp file
    fs.unlink(tempPath, () => {});
  });
}

async function exportExcel(res, data, filename, reportTitle) {
  if (data.length === 0) {
    return res.status(400).json({ error: 'No data to export' });
  }
  
  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.json_to_sheet(data);
  
  // Add title row
  xlsx.utils.sheet_add_aoa(worksheet, [[reportTitle]], { origin: 'A1' });
  xlsx.utils.sheet_add_aoa(worksheet, [['']], { origin: 'A2' }); // Empty row
  
  // Adjust column widths
  const colWidths = Object.keys(data[0]).map(key => ({
    wch: Math.max(key.length, 15)
  }));
  worksheet['!cols'] = colWidths;
  
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Report');
  
  const tempPath = path.join(__dirname, '../downloads', `${filename}.xlsx`);
  xlsx.writeFile(workbook, tempPath);
  
  res.download(tempPath, `${filename}.xlsx`, (err) => {
    if (err) {
      console.error('Error downloading Excel:', err);
    }
    // Clean up temp file
    fs.unlink(tempPath, () => {});
  });
}

async function exportPDF(res, data, filename, reportTitle, startDate, endDate) {
  if (data.length === 0) {
    return res.status(400).json({ error: 'No data to export' });
  }
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Generate HTML content
    const htmlContent = generatePDFHTML(data, reportTitle, startDate, endDate);
    
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const tempPath = path.join(__dirname, '../downloads', `${filename}.pdf`);
    
    await page.pdf({
      path: tempPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });
    
    res.download(tempPath, `${filename}.pdf`, (err) => {
      if (err) {
        console.error('Error downloading PDF:', err);
      }
      // Clean up temp file
      fs.unlink(tempPath, () => {});
    });
  } finally {
    await browser.close();
  }
}

function generatePDFHTML(data, title, startDate, endDate) {
  const headers = Object.keys(data[0]);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          font-size: 12px;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #333;
          padding-bottom: 20px;
        }
        .header h1 {
          margin: 0;
          color: #333;
          font-size: 24px;
        }
        .header p {
          margin: 10px 0 0 0;
          color: #666;
          font-size: 14px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f2f2f2;
          font-weight: bold;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 10px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <p>Date Range: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}</p>
        <p>Generated: ${new Date().toLocaleString()}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            ${headers.map(header => `<th>${header}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${headers.map(header => `<td>${row[header] || ''}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="footer">
        <p>NetControl Web Application - Report generated on ${new Date().toLocaleString()}</p>
      </div>
    </body>
    </html>
  `;
}

module.exports = router;