const cron = require('node-cron');
const db = require('../database/postgres-js-db');
const { sendMonthlyReportEmail } = require('../routes/reports');

let scheduledTask = null;

async function getSchedulerSettings() {
  const rows = await db.sql`
    SELECT key, value FROM settings
    WHERE key IN ('monthly_report_enabled', 'monthly_report_day', 'monthly_report_time', 'monthly_report_timezone', 'monthly_report_callsign', 'arrl_section_email', 'app_timezone')
  `;
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  return settings;
}

function buildCronExpression(day, time) {
  // time is "HH:MM", day is 1-28
  const [hour, minute] = (time || '08:00').split(':');
  const dayNum = parseInt(day) || 1;
  // cron: minute hour dayOfMonth month dayOfWeek
  return `${parseInt(minute)} ${parseInt(hour)} ${dayNum} * *`;
}

async function startScheduler() {
  // Stop any existing task
  stopScheduler();

  try {
    const settings = await getSchedulerSettings();

    if (settings.monthly_report_enabled !== 'true') {
      console.log('Monthly report scheduler: disabled');
      return;
    }

    if (!settings.arrl_section_email) {
      console.log('Monthly report scheduler: no recipient email configured');
      return;
    }

    if (!settings.monthly_report_callsign) {
      console.log('Monthly report scheduler: no sender call sign configured');
      return;
    }

    const cronExpr = buildCronExpression(settings.monthly_report_day, settings.monthly_report_time);
    const timezone = settings.monthly_report_timezone || settings.app_timezone || 'America/New_York';
    console.log('Monthly report scheduler: starting with cron', cronExpr, timezone ? ('tz=' + timezone) : '(server default)');

    const cronOptions = { scheduled: true };
    if (timezone) {
      cronOptions.timezone = timezone;
    }

    scheduledTask = cron.schedule(cronExpr, async () => {
      console.log('Monthly report scheduler: running scheduled report...');
      try {
        // Re-read settings at execution time in case they changed
        const currentSettings = await getSchedulerSettings();

        if (currentSettings.monthly_report_enabled !== 'true') {
          console.log('Monthly report scheduler: disabled at execution time, skipping');
          return;
        }

        const result = await sendMonthlyReportEmail({
          recipientEmail: currentSettings.arrl_section_email,
          callerCallSign: (currentSettings.monthly_report_callsign || '').toUpperCase(),
          callerEmail: null // automated send, no reply-to override
        });

        console.log('Monthly report scheduler: sent successfully to', result.toEmail, 'for', result.monthName);
      } catch (err) {
        console.error('Monthly report scheduler: failed to send:', err.message);
      }
    }, cronOptions);

    console.log('Monthly report scheduler: active, next run on day', settings.monthly_report_day || '1', 'at', settings.monthly_report_time || '08:00', timezone ? ('(' + timezone + ')') : '(server time)');
  } catch (err) {
    console.error('Monthly report scheduler: failed to start:', err.message);
  }
}

function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('Monthly report scheduler: stopped');
  }
}

module.exports = { startScheduler, stopScheduler };
