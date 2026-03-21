# Net Scheduling System

## Overview

The Net Scheduling system allows you to create recurring schedules for net operations and assign operators to run them. This feature provides robust scheduling capabilities with support for:

- **Recurring patterns**: Daily, weekly, bi-weekly, and monthly schedules
- **Operator assignments**: Assign multiple operators who rotate through net control duties
- **Exception handling**: Override specific dates in a recurring series for cancellations, reassignments, or time changes
- **Calendar view**: See upcoming scheduled nets with assigned operators

## Features

### 1. Schedule Management

Create and manage recurring net schedules with the following properties:

- **Name**: Descriptive name for the schedule (e.g., "Tuesday Night Net")
- **Description**: Optional detailed description
- **Frequency & Mode**: Radio frequency and mode (FM, AM, SSB, CW, Digital)
- **Net Type**: Regular, Emergency, Training, or Special Event
- **Start Time**: When the net begins
- **Duration**: How long the net typically runs (in minutes)
- **Recurrence Pattern**: 
  - Daily: Runs every day
  - Weekly: Runs on specific days of the week
  - Bi-weekly: Runs every other week on specific days
  - Monthly: Runs on the same day of each month
- **Date Range**: Start date (required) and optional end date
- **Status**: Active or Inactive

### 2. Operator Assignments

Assign multiple operators to each schedule:

- Operators are assigned in order (1, 2, 3, etc.)
- The system automatically rotates through assigned operators
- Each occurrence of the net is assigned to the next operator in the rotation
- You can add or remove operators at any time
- Only users with call signs can be assigned as net control operators

**Example**: If you assign three operators (W1ABC, K2DEF, N3GHI) to a weekly schedule:
- Week 1: W1ABC runs the net
- Week 2: K2DEF runs the net
- Week 3: N3GHI runs the net
- Week 4: W1ABC runs the net (rotation continues)

### 3. Exception Management

Override specific dates in a recurring schedule with three types of exceptions:

#### Cancelled
Mark a specific date as cancelled - the net will not run on that date.

**Use cases**:
- Holiday closures
- Weather emergencies
- Facility unavailability

#### Reassigned
Assign a different operator for a specific date.

**Use cases**:
- Regular operator is unavailable
- Guest net control operator
- Training opportunity for new operator

#### Time Change
Change the start time or duration for a specific date.

**Use cases**:
- Special event timing
- Daylight saving time adjustments
- Facility schedule conflicts

### 4. Upcoming Nets Calendar

View all scheduled nets for the next 60 days:

- Shows date, time, and assigned operator
- Highlights exceptions (cancelled, reassigned, time changed)
- Organized chronologically
- Updates automatically when schedules change

## Usage Guide

### Creating a Schedule

1. Navigate to **Net Schedules** from the main menu
2. Click **New Schedule**
3. Fill in the schedule details:
   - Enter a descriptive name
   - Set the frequency and mode
   - Choose start time and duration
   - Select recurrence pattern
   - For weekly/bi-weekly: check the days of week
   - Set start date (and optional end date)
4. Click **Create Schedule**

### Assigning Operators

1. Find the schedule in the list
2. Use the **+ Add Operator** dropdown
3. Select an operator from the list
4. Repeat to add multiple operators
5. Operators will rotate in the order they were added
6. To remove an operator, click the X on their badge

### Adding Exceptions

1. Click the calendar icon on a schedule
2. Click **Add Exception**
3. Select the date for the exception
4. Choose exception type:
   - **Cancelled**: No additional fields needed
   - **Reassigned**: Select the replacement operator
   - **Time Change**: Enter new start time and/or duration
5. Optionally add a reason for the exception
6. Click **Add Exception**

### Viewing Upcoming Nets

The right sidebar shows all upcoming scheduled nets:
- Date and time of each net
- Assigned net control operator
- Any exceptions that apply
- Automatically updates when you make changes

## Database Schema

### net_schedules
Stores recurring schedule templates.

**Key fields**:
- `name`, `description`: Schedule identification
- `frequency`, `mode`, `net_type`: Net configuration
- `start_time`, `duration_minutes`: Timing
- `recurrence_type`: daily, weekly, biweekly, monthly
- `days_of_week`: Comma-separated day numbers (0=Sunday, 6=Saturday)
- `start_date`, `end_date`: Date range
- `active`: Enable/disable schedule

### net_schedule_assignments
Links operators to schedules.

**Key fields**:
- `schedule_id`: References net_schedules
- `user_id`: References users table
- `call_sign`, `name`: Operator identification
- `assignment_order`: Rotation order
- `active`: Enable/disable assignment

### net_schedule_exceptions
Overrides for specific dates.

**Key fields**:
- `schedule_id`: References net_schedules
- `exception_date`: The date to override
- `exception_type`: cancelled, reassigned, time_change
- `assigned_user_id`, `assigned_call_sign`, `assigned_name`: For reassignments
- `new_start_time`, `new_duration_minutes`: For time changes
- `reason`: Optional explanation

## API Endpoints

### Schedules
- `GET /api/schedules` - List all schedules with assignments and exceptions
- `GET /api/schedules/:id` - Get single schedule details
- `POST /api/schedules` - Create new schedule
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule

### Assignments
- `POST /api/schedules/:id/assignments` - Add operator assignment
- `PUT /api/schedules/:id/assignments/:assignmentId` - Update assignment
- `DELETE /api/schedules/:id/assignments/:assignmentId` - Remove assignment

### Exceptions
- `POST /api/schedules/:id/exceptions` - Add exception
- `PUT /api/schedules/:id/exceptions/:exceptionId` - Update exception
- `DELETE /api/schedules/:id/exceptions/:exceptionId` - Remove exception

### Calendar
- `GET /api/schedules/calendar/upcoming` - Get upcoming scheduled nets
  - Query params: `days` (default 30), `start_date`, `end_date`

## Best Practices

1. **Use descriptive names**: "Tuesday Evening 2m Net" is better than "Net 1"

2. **Set end dates for temporary schedules**: Special event nets should have defined end dates

3. **Add exceptions early**: If you know an operator will be unavailable, add the exception as soon as possible

4. **Document reasons**: Use the reason field for exceptions to maintain clear records

5. **Rotate operators fairly**: Assign multiple operators to distribute the workload

6. **Review upcoming nets regularly**: Check the calendar to ensure proper coverage

7. **Keep schedules active**: Deactivate schedules instead of deleting them to preserve history

8. **Coordinate with operators**: Ensure assigned operators are aware of their scheduled duties

## Tips

- **Bi-weekly schedules**: The system calculates bi-weekly from the start date, so set the start date to the first occurrence
- **Multiple schedules**: You can create multiple schedules for different nets (e.g., morning net, evening net)
- **Inactive schedules**: Use the inactive status for seasonal nets or temporary suspensions
- **Assignment order**: The order matters for rotation - reorder by removing and re-adding if needed
- **Exception priority**: Exceptions always override the regular schedule for that specific date

## Future Enhancements

Potential features for future development:

- Email notifications to assigned operators
- Operator availability calendar
- Conflict detection across multiple schedules
- Mobile app for schedule viewing
- Integration with session creation (auto-populate from schedule)
- Operator preference management
- Schedule templates
- Bulk exception management
- Export schedules to calendar formats (iCal, Google Calendar)
