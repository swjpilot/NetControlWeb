const express = require('express');
const router = express.Router();
const db = require('../database/postgres-js-db');
const { authenticateToken, requireAdmin } = require('./auth-postgres-js');

// Get all net schedules with assignments
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { active_only } = req.query;
    
    let schedules;
    if (active_only === 'true') {
      schedules = await db.sql`
        SELECT * FROM net_schedules 
        WHERE active = true 
        ORDER BY start_time, name
      `;
    } else {
      schedules = await db.sql`
        SELECT * FROM net_schedules 
        ORDER BY active DESC, start_time, name
      `;
    }

    // Get assignments for each schedule
    const schedulesWithAssignments = await Promise.all(
      schedules.map(async (schedule) => {
        const assignments = await db.sql`
          SELECT nsa.*, u.call_sign, u.name
          FROM net_schedule_assignments nsa
          LEFT JOIN users u ON nsa.user_id = u.id
          WHERE nsa.schedule_id = ${schedule.id}
          ORDER BY nsa.assignment_order, nsa.created_at
        `;

        const exceptions = await db.sql`
          SELECT nse.*, u.username as created_by_username
          FROM net_schedule_exceptions nse
          LEFT JOIN users u ON nse.created_by = u.id
          WHERE nse.schedule_id = ${schedule.id}
          ORDER BY nse.exception_date DESC
        `;

        return {
          ...schedule,
          assignments,
          exceptions
        };
      })
    );

    res.json({ schedules: schedulesWithAssignments });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single schedule by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const schedules = await db.sql`
      SELECT * FROM net_schedules WHERE id = ${id}
    `;

    if (schedules.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const schedule = schedules[0];

    // Get assignments
    const assignments = await db.sql`
      SELECT nsa.*, u.call_sign, u.name
      FROM net_schedule_assignments nsa
      LEFT JOIN users u ON nsa.user_id = u.id
      WHERE nsa.schedule_id = ${id}
      ORDER BY nsa.assignment_order, nsa.created_at
    `;

    // Get exceptions
    const exceptions = await db.sql`
      SELECT nse.*, u.username as created_by_username
      FROM net_schedule_exceptions nse
      LEFT JOIN users u ON nse.created_by = u.id
      WHERE nse.schedule_id = ${id}
      ORDER BY nse.exception_date DESC
    `;

    res.json({
      schedule: {
        ...schedule,
        assignments,
        exceptions
      }
    });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new schedule
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Safely extract values from req.body with defaults
    const name = req.body.name ?? null;
    const description = req.body.description ?? null;
    const frequency = req.body.frequency ?? null;
    const mode = req.body.mode ?? null;
    const net_type = req.body.net_type ?? null;
    const start_time = req.body.start_time ?? null;
    const duration_minutes = req.body.duration_minutes ?? null;
    const recurrence_type = req.body.recurrence_type ?? null;
    const days_of_week = req.body.days_of_week ?? null;
    const start_date = req.body.start_date ?? null;
    const end_date = req.body.end_date ?? null;
    const active = req.body.active ?? null;
    const assignments = req.body.assignments ?? null;
    const monthly_ordinal = req.body.monthly_ordinal ?? null;
    const monthly_weekday = req.body.monthly_weekday ?? null;

    // Log incoming data for debugging
    console.log('Received schedule data:', JSON.stringify(req.body, null, 2));

    // Validate required fields
    if (!name || !start_time || !recurrence_type || !start_date) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, start_time, recurrence_type, start_date' 
      });
    }

    // Validate days_of_week for weekly/biweekly
    if ((recurrence_type === 'weekly' || recurrence_type === 'biweekly') && !days_of_week) {
      return res.status(400).json({ 
        error: 'Days of week are required for weekly and bi-weekly schedules' 
      });
    }

    // AGGRESSIVE null conversion - handle every possible falsy value
    const safeString = (val) => {
      if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined') {
        return null;
      }
      if (typeof val === 'string') {
        const trimmed = val.trim();
        return trimmed === '' ? null : trimmed;
      }
      return val;
    };

    const safeNumber = (val, defaultVal) => {
      if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined') {
        return defaultVal;
      }
      const num = parseInt(val);
      return isNaN(num) ? defaultVal : num;
    };

    const safeBoolean = (val) => {
      if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined') {
        return true; // default to active
      }
      if (typeof val === 'string') {
        return val.toLowerCase() !== 'false';
      }
      return val !== false;
    };

    // Clean all values
    const cleanName = safeString(name);
    const cleanDescription = safeString(description);
    const cleanFrequency = safeString(frequency);
    const cleanMode = safeString(mode) || 'FM';
    const cleanNetType = safeString(net_type) || 'Regular';
    const cleanStartTime = safeString(start_time);
    const cleanDuration = safeNumber(duration_minutes, 60);
    const cleanRecurrenceType = safeString(recurrence_type);
    const cleanDaysOfWeek = safeString(days_of_week);
    const cleanStartDate = safeString(start_date);
    const cleanEndDate = safeString(end_date);
    const cleanActive = safeBoolean(active);
    const cleanMonthlyOrdinal = safeNumber(monthly_ordinal, null);
    const cleanMonthlyWeekday = safeNumber(monthly_weekday, null);
    const cleanCreatedBy = req.user?.userId ?? req.user?.id ?? null;

    // Final validation - ensure no undefined values
    if (cleanName === null || cleanStartTime === null || cleanRecurrenceType === null || cleanStartDate === null) {
      return res.status(400).json({ 
        error: 'Required fields cannot be empty after cleaning' 
      });
    }

    if (cleanCreatedBy === null) {
      console.error('User authentication failed. req.user:', req.user);
      return res.status(401).json({ 
        error: 'User authentication failed - no user ID found' 
      });
    }

    // Create array of values to check for undefined
    const valuesToInsert = [
      cleanName,
      cleanDescription,
      cleanFrequency,
      cleanMode,
      cleanNetType,
      cleanStartTime,
      cleanDuration,
      cleanRecurrenceType,
      cleanDaysOfWeek,
      cleanStartDate,
      cleanEndDate,
      cleanActive,
      cleanCreatedBy
    ];

    // Check if any value is still undefined
    const undefinedIndex = valuesToInsert.findIndex(v => v === undefined);
    if (undefinedIndex !== -1) {
      const fieldNames = [
        'name', 'description', 'frequency', 'mode', 'net_type',
        'start_time', 'duration_minutes', 'recurrence_type',
        'days_of_week', 'start_date', 'end_date', 'active', 'created_by'
      ];
      console.error(`UNDEFINED VALUE DETECTED at index ${undefinedIndex}: ${fieldNames[undefinedIndex]}`);
      return res.status(400).json({ 
        error: `Field ${fieldNames[undefinedIndex]} has undefined value` 
      });
    }

    console.log('Cleaned values for database:', {
      cleanName,
      cleanDescription,
      cleanFrequency,
      cleanMode,
      cleanNetType,
      cleanStartTime,
      cleanDuration,
      cleanRecurrenceType,
      cleanDaysOfWeek,
      cleanStartDate,
      cleanEndDate,
      cleanActive,
      cleanCreatedBy
    });

    // Create schedule with guaranteed non-undefined values
    const newSchedule = await db.sql`
      INSERT INTO net_schedules (
        name, description, frequency, mode, net_type, 
        start_time, duration_minutes, recurrence_type, 
        days_of_week, start_date, end_date, active, created_by,
        monthly_ordinal, monthly_weekday
      )
      VALUES (
        ${cleanName}, ${cleanDescription}, ${cleanFrequency}, 
        ${cleanMode}, ${cleanNetType},
        ${cleanStartTime}, ${cleanDuration}, ${cleanRecurrenceType},
        ${cleanDaysOfWeek}, ${cleanStartDate}, ${cleanEndDate},
        ${cleanActive}, ${cleanCreatedBy},
        ${cleanMonthlyOrdinal}, ${cleanMonthlyWeekday}
      )
      RETURNING *
    `;

    const schedule = newSchedule[0];
    console.log('Schedule created successfully:', schedule.id);

    // Add assignments if provided
    if (assignments && assignments.length > 0) {
      for (let i = 0; i < assignments.length; i++) {
        const assignment = assignments[i];
        await db.sql`
          INSERT INTO net_schedule_assignments (
            schedule_id, user_id, call_sign, name, assignment_order
          )
          VALUES (
            ${schedule.id}, ${assignment.user_id}, 
            ${assignment.call_sign}, ${assignment.name}, ${i + 1}
          )
        `;
      }
    }

    res.status(201).json({ 
      message: 'Schedule created successfully',
      schedule
    });
  } catch (error) {
    console.error('Create schedule error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    res.status(500).json({ 
      error: error.message || 'Failed to create schedule',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update schedule
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Safely extract values with nullish coalescing
    const name = req.body.name ?? null;
    const description = req.body.description ?? null;
    const frequency = req.body.frequency ?? null;
    const mode = req.body.mode ?? null;
    const net_type = req.body.net_type ?? null;
    const start_time = req.body.start_time ?? null;
    const duration_minutes = req.body.duration_minutes ?? null;
    const recurrence_type = req.body.recurrence_type ?? null;
    const days_of_week = req.body.days_of_week ?? null;
    const start_date = req.body.start_date ?? null;
    const end_date = req.body.end_date ?? null;
    const active = req.body.active ?? null;
    const monthly_ordinal = req.body.monthly_ordinal ?? null;
    const monthly_weekday = req.body.monthly_weekday ?? null;

    // AGGRESSIVE null conversion
    const safeString = (val) => {
      if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined') return null;
      if (typeof val === 'string') { const t = val.trim(); return t === '' ? null : t; }
      return val;
    };
    const safeNumber = (val, defaultVal) => {
      if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined') return defaultVal;
      const num = parseInt(val);
      return isNaN(num) ? defaultVal : num;
    };
    const safeBoolean = (val) => {
      if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined') return true;
      if (typeof val === 'string') return val.toLowerCase() !== 'false';
      return val !== false;
    };

    const cleanName = safeString(name);
    const cleanDescription = safeString(description);
    const cleanFrequency = safeString(frequency);
    const cleanMode = safeString(mode) || 'FM';
    const cleanNetType = safeString(net_type) || 'Regular';
    const cleanStartTime = safeString(start_time);
    const cleanDuration = safeNumber(duration_minutes, 60);
    const cleanRecurrenceType = safeString(recurrence_type);
    const cleanDaysOfWeek = safeString(days_of_week);
    const cleanStartDate = safeString(start_date);
    const cleanEndDate = safeString(end_date);
    const cleanActive = safeBoolean(active);
    const cleanMonthlyOrdinal = safeNumber(monthly_ordinal, null);
    const cleanMonthlyWeekday = safeNumber(monthly_weekday, null);

    if (!cleanName || !cleanStartTime || !cleanRecurrenceType || !cleanStartDate) {
      return res.status(400).json({ error: 'Missing required fields: name, start_time, recurrence_type, start_date' });
    }

    const updated = await db.sql`
      UPDATE net_schedules
      SET 
        name = ${cleanName},
        description = ${cleanDescription},
        frequency = ${cleanFrequency},
        mode = ${cleanMode},
        net_type = ${cleanNetType},
        start_time = ${cleanStartTime},
        duration_minutes = ${cleanDuration},
        recurrence_type = ${cleanRecurrenceType},
        days_of_week = ${cleanDaysOfWeek},
        start_date = ${cleanStartDate},
        end_date = ${cleanEndDate},
        active = ${cleanActive},
        monthly_ordinal = ${cleanMonthlyOrdinal},
        monthly_weekday = ${cleanMonthlyWeekday},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (updated.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json({ 
      message: 'Schedule updated successfully',
      schedule: updated[0]
    });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete schedule
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await db.sql`
      DELETE FROM net_schedules WHERE id = ${id} RETURNING *
    `;

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add assignment to schedule
router.post('/:id/assignments', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Use nullish coalescing to safely extract values
    const user_id = req.body.user_id ?? null;
    const call_sign = req.body.call_sign ?? null;
    const name = req.body.name ?? null;
    const assignment_order = req.body.assignment_order ?? 1;

    // Log incoming data for debugging
    console.log('Add assignment - received data:', JSON.stringify(req.body, null, 2));
    console.log('Add assignment - extracted values:', { user_id, call_sign, name, assignment_order });

    if (!user_id || !call_sign) {
      console.error('Add assignment - validation failed:', { user_id, call_sign });
      return res.status(400).json({ error: 'user_id and call_sign are required' });
    }

    const assignment = await db.sql`
      INSERT INTO net_schedule_assignments (
        schedule_id, user_id, call_sign, name, assignment_order
      )
      VALUES (${id}, ${user_id}, ${call_sign}, ${name}, ${assignment_order})
      RETURNING *
    `;

    console.log('Assignment created successfully:', assignment[0].id);
    res.status(201).json({ 
      message: 'Assignment added successfully',
      assignment: assignment[0]
    });
  } catch (error) {
    console.error('Add assignment error:', error);
    console.error('Error stack:', error.stack);
    if (error.message.includes('duplicate key')) {
      return res.status(400).json({ error: 'User already assigned to this schedule' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update assignment
router.put('/:id/assignments/:assignmentId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { assignment_order, active } = req.body;

    const updated = await db.sql`
      UPDATE net_schedule_assignments
      SET 
        assignment_order = COALESCE(${assignment_order}, assignment_order),
        active = COALESCE(${active}, active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${assignmentId}
      RETURNING *
    `;

    if (updated.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ 
      message: 'Assignment updated successfully',
      assignment: updated[0]
    });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete assignment
router.delete('/:id/assignments/:assignmentId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const deleted = await db.sql`
      DELETE FROM net_schedule_assignments WHERE id = ${assignmentId} RETURNING *
    `;

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    res.json({ message: 'Assignment removed successfully' });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add exception to schedule
router.post('/:id/exceptions', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Safely extract values with nullish coalescing
    const exception_date = req.body.exception_date ?? null;
    const exception_type = req.body.exception_type ?? null;
    const assigned_user_id = req.body.assigned_user_id ?? null;
    const assigned_call_sign = req.body.assigned_call_sign ?? null;
    const assigned_name = req.body.assigned_name ?? null;
    const new_start_time = req.body.new_start_time ?? null;
    const new_duration_minutes = req.body.new_duration_minutes ?? null;
    const reason = req.body.reason ?? null;

    // Log incoming data for debugging
    console.log('Add exception - received data:', JSON.stringify(req.body, null, 2));
    console.log('Add exception - extracted values:', {
      exception_date,
      exception_type,
      assigned_user_id,
      assigned_call_sign,
      assigned_name,
      new_start_time,
      new_duration_minutes,
      reason
    });

    if (!exception_date || !exception_type) {
      console.error('Add exception - validation failed:', { exception_date, exception_type });
      return res.status(400).json({ error: 'exception_date and exception_type are required' });
    }

    // AGGRESSIVE null conversion
    const safeString = (val) => {
      if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined') return null;
      if (typeof val === 'string') { const t = val.trim(); return t === '' ? null : t; }
      return val;
    };
    const safeNumber = (val) => {
      if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined') return null;
      const num = parseInt(val);
      return isNaN(num) ? null : num;
    };

    const cleanExceptionDate = safeString(exception_date);
    const cleanExceptionType = safeString(exception_type);
    const cleanAssignedUserId = safeNumber(assigned_user_id);
    const cleanAssignedCallSign = safeString(assigned_call_sign);
    const cleanAssignedName = safeString(assigned_name);
    const cleanNewStartTime = safeString(new_start_time);
    const cleanNewDurationMinutes = safeNumber(new_duration_minutes);
    const cleanReason = safeString(reason);
    const cleanCreatedBy = req.user?.userId ?? req.user?.id ?? null;

    if (!cleanExceptionDate || !cleanExceptionType) {
      return res.status(400).json({ error: 'Required fields cannot be empty after cleaning' });
    }

    if (cleanCreatedBy === null) {
      console.error('User authentication failed. req.user:', req.user);
      return res.status(401).json({ error: 'User authentication failed - no user ID found' });
    }

    console.log('Cleaned values for database:', {
      cleanExceptionDate,
      cleanExceptionType,
      cleanAssignedUserId,
      cleanAssignedCallSign,
      cleanAssignedName,
      cleanNewStartTime,
      cleanNewDurationMinutes,
      cleanReason,
      cleanCreatedBy
    });

    const exception = await db.sql`
      INSERT INTO net_schedule_exceptions (
        schedule_id, exception_date, exception_type,
        assigned_user_id, assigned_call_sign, assigned_name,
        new_start_time, new_duration_minutes, reason, created_by
      )
      VALUES (
        ${id}, ${cleanExceptionDate}, ${cleanExceptionType},
        ${cleanAssignedUserId}, ${cleanAssignedCallSign}, ${cleanAssignedName},
        ${cleanNewStartTime}, ${cleanNewDurationMinutes}, 
        ${cleanReason}, ${cleanCreatedBy}
      )
      RETURNING *
    `;

    console.log('Exception created successfully:', exception[0].id);
    res.status(201).json({ 
      message: 'Exception added successfully',
      exception: exception[0]
    });
  } catch (error) {
    console.error('Add exception error:', error);
    console.error('Error stack:', error.stack);
    if (error.message.includes('duplicate key')) {
      return res.status(400).json({ error: 'Exception already exists for this date' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update exception
router.put('/:id/exceptions/:exceptionId', authenticateToken, async (req, res) => {
  try {
    const { exceptionId } = req.params;
    const {
      exception_type,
      assigned_user_id,
      assigned_call_sign,
      assigned_name,
      new_start_time,
      new_duration_minutes,
      reason
    } = req.body;

    const updated = await db.sql`
      UPDATE net_schedule_exceptions
      SET 
        exception_type = COALESCE(${exception_type}, exception_type),
        assigned_user_id = COALESCE(${assigned_user_id}, assigned_user_id),
        assigned_call_sign = COALESCE(${assigned_call_sign}, assigned_call_sign),
        assigned_name = COALESCE(${assigned_name}, assigned_name),
        new_start_time = COALESCE(${new_start_time}, new_start_time),
        new_duration_minutes = COALESCE(${new_duration_minutes}, new_duration_minutes),
        reason = COALESCE(${reason}, reason),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${exceptionId}
      RETURNING *
    `;

    if (updated.length === 0) {
      return res.status(404).json({ error: 'Exception not found' });
    }

    res.json({ 
      message: 'Exception updated successfully',
      exception: updated[0]
    });
  } catch (error) {
    console.error('Update exception error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete exception
router.delete('/:id/exceptions/:exceptionId', authenticateToken, async (req, res) => {
  try {
    const { exceptionId } = req.params;

    const deleted = await db.sql`
      DELETE FROM net_schedule_exceptions WHERE id = ${exceptionId} RETURNING *
    `;

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Exception not found' });
    }

    res.json({ message: 'Exception removed successfully' });
  } catch (error) {
    console.error('Delete exception error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get upcoming scheduled nets (next 30 days by default)
router.get('/calendar/upcoming', authenticateToken, async (req, res) => {
  try {
    const { days = 30, start_date, end_date } = req.query;
    
    const startDate = start_date || new Date().toISOString().split('T')[0];
    const endDate = end_date || new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get all active schedules
    const schedules = await db.sql`
      SELECT * FROM net_schedules 
      WHERE active = true 
      AND start_date <= ${endDate}
      AND (end_date IS NULL OR end_date >= ${startDate})
    `;

    const upcomingNets = [];

    for (const schedule of schedules) {
      // Get assignments for this schedule
      const assignments = await db.sql`
        SELECT * FROM net_schedule_assignments 
        WHERE schedule_id = ${schedule.id} AND active = true
        ORDER BY assignment_order
      `;

      // Get exceptions for this schedule
      const exceptions = await db.sql`
        SELECT * FROM net_schedule_exceptions 
        WHERE schedule_id = ${schedule.id}
        AND exception_date BETWEEN ${startDate} AND ${endDate}
      `;

      const exceptionMap = {};
      exceptions.forEach(ex => {
        exceptionMap[ex.exception_date.toISOString().split('T')[0]] = ex;
      });

      // Generate occurrences based on recurrence pattern
      const occurrences = generateOccurrences(schedule, startDate, endDate, assignments, exceptionMap);
      upcomingNets.push(...occurrences);
    }

    // Sort by date and time
    upcomingNets.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.start_time.localeCompare(b.start_time);
    });

    res.json({ upcoming_nets: upcomingNets });
  } catch (error) {
    console.error('Get upcoming nets error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to generate occurrences
function generateOccurrences(schedule, startDate, endDate, assignments, exceptionMap) {
  const occurrences = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const scheduleStart = new Date(schedule.start_date);
  const scheduleEnd = schedule.end_date ? new Date(schedule.end_date) : null;

  let currentDate = new Date(Math.max(start, scheduleStart));
  
  while (currentDate <= end && (!scheduleEnd || currentDate <= scheduleEnd)) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday

    let shouldInclude = false;

    // Check if this date matches the recurrence pattern
    if (schedule.recurrence_type === 'daily') {
      shouldInclude = true;
    } else if (schedule.recurrence_type === 'weekly' || schedule.recurrence_type === 'biweekly') {
      if (schedule.days_of_week) {
        const daysArray = schedule.days_of_week.split(',').map(d => parseInt(d.trim()));
        shouldInclude = daysArray.includes(dayOfWeek);

        // For biweekly, check if it's the right week
        if (shouldInclude && schedule.recurrence_type === 'biweekly') {
          const daysDiff = Math.floor((currentDate - scheduleStart) / (1000 * 60 * 60 * 24));
          const weeksDiff = Math.floor(daysDiff / 7);
          shouldInclude = weeksDiff % 2 === 0;
        }
      }
    } else if (schedule.recurrence_type === 'monthly') {
      if (schedule.monthly_ordinal && schedule.monthly_weekday !== null && schedule.monthly_weekday !== undefined) {
        // Ordinal weekday scheduling (e.g., 1st Friday, 2nd Saturday)
        const ordinal = schedule.monthly_ordinal; // 1-5 (5 = last)
        const targetWeekday = schedule.monthly_weekday; // 0=Sun, 6=Sat
        
        // Check if currentDate matches the Nth weekday of its month
        if (dayOfWeek === targetWeekday) {
          const dayOfMonth = currentDate.getDate();
          const weekNumber = Math.ceil(dayOfMonth / 7);
          
          if (ordinal === 5) {
            // "Last" weekday of the month - check if there's no more of this weekday in the month
            const nextWeek = new Date(currentDate);
            nextWeek.setDate(nextWeek.getDate() + 7);
            shouldInclude = nextWeek.getMonth() !== currentDate.getMonth();
          } else {
            shouldInclude = weekNumber === ordinal;
          }
        }
      } else {
        // Same day-of-month scheduling (original behavior)
        shouldInclude = currentDate.getDate() === scheduleStart.getDate();
      }
    }

    if (shouldInclude) {
      const exception = exceptionMap[dateStr];

      if (exception && exception.exception_type === 'cancelled') {
        // Skip cancelled dates
      } else {
        // Determine who is assigned (rotate through assignments or use exception)
        let assignedOperator = null;
        
        if (exception && exception.exception_type === 'reassigned') {
          assignedOperator = {
            user_id: exception.assigned_user_id,
            call_sign: exception.assigned_call_sign,
            name: exception.assigned_name
          };
        } else if (assignments.length > 0) {
          // Rotate through assignments based on occurrence count
          const occurrenceIndex = occurrences.filter(o => o.schedule_id === schedule.id).length;
          assignedOperator = assignments[occurrenceIndex % assignments.length];
        }

        occurrences.push({
          schedule_id: schedule.id,
          schedule_name: schedule.name,
          date: dateStr,
          start_time: exception?.new_start_time || schedule.start_time,
          duration_minutes: exception?.new_duration_minutes || schedule.duration_minutes,
          frequency: schedule.frequency,
          mode: schedule.mode,
          net_type: schedule.net_type,
          assigned_operator: assignedOperator,
          has_exception: !!exception,
          exception_id: exception?.id,
          exception_type: exception?.exception_type,
          exception_reason: exception?.reason
        });
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return occurrences;
}

module.exports = router;
