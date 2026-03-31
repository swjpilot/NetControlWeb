/**
 * Timezone-aware date utilities.
 * 
 * All functions read the configured timezone from the app settings.
 * If no timezone is configured, falls back to the browser's local timezone.
 */

// Module-level timezone cache — updated by SettingsContext
let _appTimezone = null;

/**
 * Set the application timezone. Called by SettingsContext when settings load.
 * @param {string} tz - IANA timezone string (e.g., 'America/New_York') or empty for browser default
 */
export function setAppTimezone(tz) {
  _appTimezone = tz || null;
}

/**
 * Get the current application timezone.
 * @returns {string|undefined} IANA timezone or undefined (browser default)
 */
export function getAppTimezone() {
  return _appTimezone || undefined;
}

/**
 * Formats a date string for display using the configured timezone.
 * Handles YYYY-MM-DD date-only strings safely (treats them as that calendar date,
 * not UTC midnight which shifts in western timezones).
 *
 * @param {string} dateString - A date string, typically YYYY-MM-DD or ISO datetime
 * @param {object} options - Intl.DateTimeFormat options (optional)
 * @returns {string} Formatted date string
 */
export function formatDateLocal(dateString, options) {
  if (!dateString) return 'N/A';
  try {
    const str = String(dateString);
    const datePart = str.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);

    if (!year || !month || !day) {
      return new Date(dateString).toLocaleDateString(undefined, options);
    }

    // Format directly from parsed parts — no timezone conversion needed
    // since we're working with date-only values (YYYY-MM-DD)
    if (options) {
      const safeDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      const tz = getAppTimezone();
      return new Intl.DateTimeFormat(undefined, { ...options, timeZone: tz || 'UTC' }).format(safeDate);
    }

    // Default format: M/D/YYYY
    return `${month}/${day}/${year}`;
  } catch {
    return String(dateString);
  }
}

/**
 * Parses a date-only string into a Date object representing that calendar date
 * in the configured timezone.
 *
 * @param {string} dateString - A date string, typically YYYY-MM-DD
 * @returns {Date} Date object
 */
export function parseDateLocal(dateString) {
  if (!dateString) return new Date();
  const datePart = String(dateString).split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return new Date(dateString);
  // Use noon UTC so timezone conversions don't shift the day
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

/**
 * Converts a date string to YYYY-MM-DD for HTML date inputs.
 *
 * @param {string} dateString - A date string from the database
 * @returns {string} YYYY-MM-DD formatted string
 */
export function toDateInputValue(dateString) {
  if (!dateString) return '';
  const datePart = String(dateString).split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  if (!year || !month || !day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Gets today's date as YYYY-MM-DD in the configured timezone.
 *
 * @returns {string} YYYY-MM-DD
 */
export function getTodayDate() {
  const tz = getAppTimezone();
  const now = new Date();
  if (tz) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    return parts; // en-CA locale gives YYYY-MM-DD format
  }
  return now.toISOString().split('T')[0];
}

/**
 * Formats a time string or datetime for display in the configured timezone.
 *
 * @param {string} timeOrDatetime - A time string (HH:MM) or full ISO datetime
 * @returns {string} Formatted time
 */
export function formatTimeLocal(timeOrDatetime) {
  if (!timeOrDatetime) return '';
  // If it's just a time string like "19:00", return as-is
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(timeOrDatetime)) return timeOrDatetime;
  // Full datetime — format in 24h
  try {
    const tz = getAppTimezone();
    const date = new Date(timeOrDatetime);
    return date.toLocaleTimeString('en-GB', { timeZone: tz || 'UTC', hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return timeOrDatetime;
  }
}
