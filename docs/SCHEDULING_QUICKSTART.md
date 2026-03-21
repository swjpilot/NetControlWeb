# Net Scheduling - Quick Start Guide

## What's New

The NetControl application now includes a comprehensive scheduling system that allows you to:

✅ Create recurring net schedules (daily, weekly, bi-weekly, monthly)
✅ Assign multiple operators who rotate through net control duties
✅ Handle exceptions for specific dates (cancellations, reassignments, time changes)
✅ View upcoming scheduled nets with assigned operators

## Getting Started

### 1. Access the Scheduling Page

After logging in, click **Net Schedules** in the left navigation menu.

### 2. Create Your First Schedule

Click the **New Schedule** button and fill in:

**Basic Information:**
- Schedule Name: e.g., "Tuesday Evening 2m Net"
- Description: Optional details about the net
- Net Type: Regular, Emergency, Training, or Special Event

**Radio Configuration:**
- Frequency: e.g., "146.520 MHz"
- Mode: FM, AM, SSB, CW, or Digital
- Duration: How long the net runs (default 60 minutes)

**Timing:**
- Start Time: When the net begins (e.g., 19:00)
- Recurrence Type: Choose from:
  - Daily: Every day
  - Weekly: Specific days each week
  - Every Other Week: Bi-weekly on specific days
  - Monthly: Same day each month

**For Weekly/Bi-weekly:**
- Check the days of the week when the net runs
- Example: Check "Tue" for Tuesday nights

**Date Range:**
- Start Date: When the schedule begins
- End Date: Optional - leave blank for ongoing schedules

Click **Create Schedule** to save.

### 3. Assign Operators

Once your schedule is created, you'll see it in the list. To assign operators:

1. Find your schedule in the list
2. Click the **+ Add Operator** dropdown
3. Select an operator from the list
4. Repeat to add more operators

**How Rotation Works:**
- Operators are assigned in the order you add them
- Each occurrence of the net goes to the next operator
- After the last operator, it cycles back to the first

**Example:**
- Add W1ABC (will run net #1, #4, #7...)
- Add K2DEF (will run net #2, #5, #8...)
- Add N3GHI (will run net #3, #6, #9...)

### 4. View Upcoming Nets

The right sidebar shows all upcoming scheduled nets for the next 60 days:
- Date and time of each net
- Which operator is assigned
- Any exceptions that apply

### 5. Handle Exceptions

Need to make a change to a specific date? Click the calendar icon on your schedule.

**Cancel a Net:**
1. Click **Add Exception**
2. Select the date
3. Choose "Cancelled"
4. Add a reason (optional)
5. Click **Add Exception**

**Reassign to Different Operator:**
1. Click **Add Exception**
2. Select the date
3. Choose "Reassigned to Different Operator"
4. Select the replacement operator
5. Add a reason (e.g., "Regular operator on vacation")
6. Click **Add Exception**

**Change Time:**
1. Click **Add Exception**
2. Select the date
3. Choose "Time Change"
4. Enter new start time and/or duration
5. Add a reason (e.g., "Special event timing")
6. Click **Add Exception**

## Common Scenarios

### Weekly Net on Tuesday Evenings

```
Name: Tuesday Evening 2m Net
Frequency: 146.520 MHz
Mode: FM
Start Time: 19:00
Duration: 60 minutes
Recurrence: Weekly
Days: Tuesday (check Tue)
Start Date: Next Tuesday
```

### Bi-weekly Net (Every Other Sunday)

```
Name: Sunday Morning HF Net
Frequency: 3.925 MHz
Mode: SSB
Start Time: 09:00
Duration: 90 minutes
Recurrence: Every Other Week
Days: Sunday (check Sun)
Start Date: This Sunday (or the first occurrence)
```

### Daily Emergency Net

```
Name: Daily Emergency Preparedness Net
Frequency: 147.000 MHz
Mode: FM
Start Time: 20:00
Duration: 30 minutes
Recurrence: Daily
Start Date: Today
```

### Monthly Club Net

```
Name: Monthly Club Business Net
Frequency: 146.520 MHz
Mode: FM
Start Time: 19:30
Duration: 120 minutes
Recurrence: Monthly
Start Date: First Tuesday of this month
```

## Tips for Success

1. **Start Simple**: Create one schedule first, test it, then add more

2. **Assign Multiple Operators**: Distribute the workload by assigning 3-4 operators per schedule

3. **Use Descriptive Names**: "Tuesday 2m Net" is clearer than "Net 1"

4. **Plan Ahead**: Add exceptions as soon as you know about conflicts

5. **Check the Calendar**: Review upcoming nets regularly to ensure coverage

6. **Document Reasons**: Use the reason field for exceptions to maintain clear records

7. **Coordinate with Operators**: Make sure assigned operators know their schedule

## Database Updates

The scheduling system automatically creates three new database tables:

- `net_schedules`: Stores recurring schedule templates
- `net_schedule_assignments`: Links operators to schedules
- `net_schedule_exceptions`: Handles date-specific overrides

These tables are created automatically when you restart the server after updating the code.

## Troubleshooting

**Can't see the Net Schedules menu?**
- Make sure you've restarted the server
- Clear your browser cache and refresh

**Operators not showing in dropdown?**
- Only users with call signs can be assigned
- Check that users have their call_sign field populated

**Schedule not appearing in upcoming nets?**
- Verify the schedule is marked as Active
- Check that the start date is not in the future
- Ensure days of week are selected for weekly/bi-weekly schedules

**Exception not working?**
- Verify the exception date falls within the schedule's date range
- Check that the date matches a scheduled occurrence
- Make sure you selected the correct exception type

## Next Steps

Once you're comfortable with basic scheduling:

1. Create schedules for all your regular nets
2. Assign backup operators for redundancy
3. Set up exceptions for known holidays
4. Review the full documentation in `docs/NET_SCHEDULING.md`
5. Consider integrating schedules with session creation

## Support

For detailed API documentation and advanced features, see:
- `docs/NET_SCHEDULING.md` - Complete feature documentation
- `test_schedule_api.sh` - API testing examples

Need help? Check the application logs or contact your system administrator.
