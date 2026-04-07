const cron = require('node-cron');
const db = require('../database/postgres-js-db');
const { sendMonthlyReportEmail } = require('../routes/reports');

let scheduledTask = null;

async function getSchedulerSettings() {
  const rows = await db.sql`
    SELECT key, value FROM settings
    WHERE key IN ('monthly_report_enabled', 'monthly_report_day', 'monthly_report_time', 'monthly_report_timezone', 'monthly_report_callsign', 'arrl_section_email', 'app_timezone', 'last_monthly_report_sent', 'last_monthly_report_status')
  `;
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  return settings;
}

function buildCronExpression(day, time) {
  const [hour, minute] = (time || '08:00').split(':');
  const dayNum = parseInt(day) || 1;
  return `${parseInt(minute)} ${parseInt(hour)} ${dayNum} * *`;
}

async function logReportStatus(status, details) {
  const value = JSON.stringify({ status, details, timestamp: new Date().toISOString() });
  await db.sql`INSERT INTO settings (key, value, description) VALUES ('last_monthly_report_status', ${value}, 'Last monthly report send status') ON CONFLICT (key) DO UPDATE SET value = ${value}`;
  await db.sql`INSERT INTO settings (key, value, description) VALUES ('last_monthly_report_sent', ${new Date().toISOString()}, 'Last monthly report send time') ON CONFLICT (key) DO UPDATE SET value = ${new Date().toISOString()}`;
}

async function sendReport(settings) {
  const result = await sendMonthlyReportEmail({
    recipientEmail: settings.arrl_section_email,
    callerCallSign: (settings.monthly_report_callsign || '').toUpperCase(),
    callerEmail: null
  });
  await logReportStatus('sent', 'Sent to ' + result.toEmail + ' for ' + result.monthName);
  console.log('Monthly report: sent to', result.toEmail, 'for', result.monthName);
  return result;
}

async function checkAndCatchUp(settings) {
  // Check if report is overdue for this month
  const reportDay = parseInt(settings.monthly_report_day) || 1;
  const now = new Date();
  const currentDay = now.getDate();
  const lastSent = settings.last_monthly_report_sent ? new Date(settings.last_monthly_report_sent) : null;
  const lastSentMonth = lastSent ? lastSent.getMonth() : -1;
  const lastSentYear = lastSent ? lastSent.getFullYear() : -1;

  // If we're past the report day this month and haven't sent for this month
  if (currentDay >= reportDay && (lastSentMonth !== now.getMonth() || lastSentYear !== now.getFullYear())) {
    console.log('Monthly report: overdue for this month (day ' + reportDay + ', last sent: ' + (lastSent ? lastSent.toISOString() : 'never') + '), sending catch-up...');
    try {
      await sendReport(settings);
    } catch (err) {
      console.error('Monthly report catch-up failed:', err.message);
      await logReportStatus('failed', err.message);
    }
  } else {
    console.log('Monthly report: on schedule (last sent: ' + (lastSent ? lastSent.toISOString() : 'never') + ')');
  }
}

async function startScheduler() {
  stopScheduler();
  try {
    const settings = await getSchedulerSettings();
    if (settings.monthly_report_enabled !== 'true') { console.log('Monthly report scheduler: disabled'); return; }
    if (!settings.arrl_section_email) { console.log('Monthly report scheduler: no email'); return; }
    if (!settings.monthly_report_callsign) { console.log('Monthly report scheduler: no callsign'); return; }

    // Check for overdue report on startup
    await checkAndCatchUp(settings);

    const cronExpr = buildCronExpression(settings.monthly_report_day, settings.monthly_report_time);
    const timezone = settings.monthly_report_timezone || settings.app_timezone || 'America/New_York';
    console.log('Monthly report scheduler:', cronExpr, 'tz=' + timezone);

    scheduledTask = cron.schedule(cronExpr, async () => {
      console.log('Monthly report scheduler: running...');
      try {
        const currentSettings = await getSchedulerSettings();
        if (currentSettings.monthly_report_enabled !== 'true') return;
        await sendReport(currentSettings);
      } catch (err) {
        console.error('Monthly report scheduler failed:', err.message);
        await logReportStatus('failed', err.message);
      }
    }, { scheduled: true, timezone: timezone });

    console.log('Monthly report scheduler: active, day', settings.monthly_report_day || '1', 'at', settings.monthly_report_time || '08:00', '(' + timezone + ')');
  } catch (err) {
    console.error('Monthly report scheduler start failed:', err.message);
  }
}

function stopScheduler() {
  if (scheduledTask) { scheduledTask.stop(); scheduledTask = null; }
}

module.exports = { startScheduler, stopScheduler };
