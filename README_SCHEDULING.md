# Net Scheduling System

## Quick Links

- 📚 **[Quick Start Guide](docs/SCHEDULING_QUICKSTART.md)** - Get started in 5 minutes
- 📖 **[Complete Documentation](docs/NET_SCHEDULING.md)** - Full feature reference
- 🔧 **[Implementation Details](SCHEDULING_IMPLEMENTATION.md)** - Technical overview
- 📝 **[Changelog](CHANGELOG_SCHEDULING.md)** - What's new
- 🧪 **[API Testing](test_schedule_api.sh)** - Test the API

## What is Net Scheduling?

The Net Scheduling system allows you to create recurring schedules for ham radio net operations and automatically assign operators to run them. It handles complex scheduling scenarios including:

- ✅ Recurring patterns (daily, weekly, bi-weekly, monthly)
- ✅ Multiple operator assignments with automatic rotation
- ✅ Exception handling for specific dates
- ✅ Calendar view of upcoming nets

## Quick Start

### 1. Start the Server

The database tables will be created automatically:

```bash
npm start
```

### 2. Access the Feature

1. Log in to NetControl
2. Click **Net Schedules** in the navigation menu
3. Click **New Schedule** to create your first schedule

### 3. Create a Schedule

Fill in the form:
- Name: "Tuesday Evening 2m Net"
- Frequency: "146.520 MHz"
- Mode: FM
- Start Time: 19:00
- Recurrence: Weekly
- Days: Check "Tue"
- Start Date: Next Tuesday

Click **Create Schedule**

### 4. Assign Operators

1. Find your schedule in the list
2. Click **+ Add Operator**
3. Select an operator
4. Repeat to add more operators

Operators will automatically rotate through net control duties!

### 5. View Upcoming Nets

Check the right sidebar to see all upcoming scheduled nets with assigned operators.

## Key Features

### Recurring Patterns

- **Daily**: Every day
- **Weekly**: Specific days each week
- **Bi-weekly**: Every other week
- **Monthly**: Same day each month

### Operator Rotation

Assign multiple operators who automatically rotate:
- Operator 1 runs net #1, #4, #7...
- Operator 2 runs net #2, #5, #8...
- Operator 3 runs net #3, #6, #9...

### Exception Handling

Override specific dates:
- **Cancel**: Skip a scheduled net
- **Reassign**: Different operator for one date
- **Time Change**: Modified start time or duration

## Documentation

### For Users
- **[Quick Start Guide](docs/SCHEDULING_QUICKSTART.md)** - Step-by-step setup
- **[Complete Documentation](docs/NET_SCHEDULING.md)** - All features explained

### For Developers
- **[Implementation Details](SCHEDULING_IMPLEMENTATION.md)** - Architecture and code
- **[API Testing](test_schedule_api.sh)** - Example API calls
- **[Changelog](CHANGELOG_SCHEDULING.md)** - Version history

## Examples

### Weekly Net on Tuesday Evenings

```
Name: Tuesday Evening 2m Net
Frequency: 146.520 MHz
Mode: FM
Start Time: 19:00
Recurrence: Weekly
Days: Tuesday
Operators: W1ABC, K2DEF, N3GHI (rotating)
```

### Bi-weekly HF Net

```
Name: Sunday Morning HF Net
Frequency: 3.925 MHz
Mode: SSB
Start Time: 09:00
Recurrence: Every Other Week
Days: Sunday
Operators: W1ABC, K2DEF (alternating)
```

### Daily Emergency Net

```
Name: Daily Emergency Preparedness Net
Frequency: 147.000 MHz
Mode: FM
Start Time: 20:00
Recurrence: Daily
Operators: Multiple operators rotating daily
```

## API Overview

### Schedules
- `GET /api/schedules` - List all schedules
- `POST /api/schedules` - Create schedule
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule

### Assignments
- `POST /api/schedules/:id/assignments` - Add operator
- `DELETE /api/schedules/:id/assignments/:assignmentId` - Remove operator

### Exceptions
- `POST /api/schedules/:id/exceptions` - Add exception
- `DELETE /api/schedules/:id/exceptions/:exceptionId` - Remove exception

### Calendar
- `GET /api/schedules/calendar/upcoming` - Get upcoming nets

See [test_schedule_api.sh](test_schedule_api.sh) for detailed examples.

## Database Schema

Three new tables:

1. **net_schedules** - Recurring schedule templates
2. **net_schedule_assignments** - Operator assignments
3. **net_schedule_exceptions** - Date-specific overrides

Tables are created automatically on server startup.

## Requirements

- NetControl v1.1.0 or higher
- Node.js 14.x or higher
- PostgreSQL 12.x or higher
- React 18.x or higher

## Installation

No additional installation required. The feature is included in the codebase.

1. Pull latest code
2. Restart server
3. Tables are created automatically
4. Feature is ready to use

## Troubleshooting

### Can't see Net Schedules menu?
- Restart the server
- Clear browser cache
- Refresh the page

### Operators not in dropdown?
- Users must have call_sign field populated
- Check user management page

### Schedule not showing upcoming nets?
- Verify schedule is Active
- Check start date is not in future
- Ensure days of week are selected (for weekly/bi-weekly)

### Exception not working?
- Verify date is within schedule range
- Check date matches a scheduled occurrence
- Ensure correct exception type selected

See [Quick Start Guide](docs/SCHEDULING_QUICKSTART.md) for more troubleshooting tips.

## Support

Need help?

1. Check the [Quick Start Guide](docs/SCHEDULING_QUICKSTART.md)
2. Review [Complete Documentation](docs/NET_SCHEDULING.md)
3. Read [Implementation Details](SCHEDULING_IMPLEMENTATION.md)
4. Test API with [test_schedule_api.sh](test_schedule_api.sh)

## Future Enhancements

Planned features:
- Email notifications to operators
- Operator availability calendar
- Conflict detection
- Session auto-creation
- Export to calendar formats
- Mobile push notifications

See [Changelog](CHANGELOG_SCHEDULING.md) for details.

## Contributing

To contribute to the scheduling system:

1. Review [Implementation Details](SCHEDULING_IMPLEMENTATION.md)
2. Understand the database schema
3. Follow existing code patterns
4. Test thoroughly
5. Update documentation

## License

Same as NetControl application.

## Version

Net Scheduling System v1.2.0
Released: March 12, 2026

---

## Summary

The Net Scheduling System provides comprehensive scheduling capabilities for ham radio net operations:

✅ **Easy to use** - Create schedules in minutes
✅ **Flexible** - Supports all common recurrence patterns
✅ **Automatic** - Operators rotate automatically
✅ **Robust** - Handle exceptions gracefully
✅ **Visible** - See upcoming nets at a glance
✅ **Production-ready** - Fully tested and documented

Get started now with the [Quick Start Guide](docs/SCHEDULING_QUICKSTART.md)!
