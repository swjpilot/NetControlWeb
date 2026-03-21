# Changelog - Net Scheduling Feature

## Version 1.2.0 - Net Scheduling System

### Added

#### Database Schema
- **net_schedules** table for recurring schedule templates
  - Support for daily, weekly, bi-weekly, and monthly recurrence patterns
  - Configurable frequency, mode, net type, and timing
  - Active/inactive status and date range support
  
- **net_schedule_assignments** table for operator assignments
  - Multiple operators per schedule with rotation order
  - Links to users table for operator details
  - Active/inactive status per assignment
  
- **net_schedule_exceptions** table for date-specific overrides
  - Three exception types: cancelled, reassigned, time_change
  - Reason field for documentation
  - Unique constraint per schedule and date

#### Backend API (server/routes/schedules.js)
- Schedule CRUD operations
  - GET /api/schedules - List all schedules
  - GET /api/schedules/:id - Get single schedule
  - POST /api/schedules - Create schedule
  - PUT /api/schedules/:id - Update schedule
  - DELETE /api/schedules/:id - Delete schedule
  
- Assignment management
  - POST /api/schedules/:id/assignments - Add operator
  - PUT /api/schedules/:id/assignments/:assignmentId - Update assignment
  - DELETE /api/schedules/:id/assignments/:assignmentId - Remove operator
  
- Exception management
  - POST /api/schedules/:id/exceptions - Add exception
  - PUT /api/schedules/:id/exceptions/:exceptionId - Update exception
  - DELETE /api/schedules/:id/exceptions/:exceptionId - Remove exception
  
- Calendar generation
  - GET /api/schedules/calendar/upcoming - Generate upcoming nets
  - Intelligent occurrence calculation with operator rotation
  - Exception handling (cancellations, reassignments, time changes)
  - Configurable date range (default 30 days)

#### Frontend Component (client/src/pages/NetSchedules.js)
- Comprehensive schedule management interface
  - Create/edit schedule form with validation
  - Visual schedule list with status indicators
  - Operator assignment management
  - Exception management modal
  - Upcoming nets calendar sidebar (60-day view)
  
- User experience features
  - Real-time updates using React Query
  - Toast notifications for all actions
  - Mobile-responsive design
  - Form validation with helpful error messages
  - Conditional form fields based on recurrence type

#### Navigation
- Added "Net Schedules" menu item in Layout.js
- Positioned between "Net Sessions" and "Operators"
- Uses Activity icon for visual consistency
- Added /schedules route in App.js

#### Documentation
- **docs/NET_SCHEDULING.md** - Complete feature documentation
  - Database schema details
  - API endpoint reference
  - Usage guide with examples
  - Best practices and tips
  
- **docs/SCHEDULING_QUICKSTART.md** - Quick start guide
  - Step-by-step setup instructions
  - Common scenarios with examples
  - Troubleshooting section
  
- **SCHEDULING_IMPLEMENTATION.md** - Technical implementation details
  - Architecture overview
  - Code structure
  - Testing procedures
  - Future enhancement ideas
  
- **test_schedule_api.sh** - API testing examples

### Features

#### Recurring Schedule Patterns
- **Daily**: Runs every day within date range
- **Weekly**: Select specific days of week (multiple days supported)
- **Bi-weekly**: Every other week on specific days
- **Monthly**: Same day of each month

#### Operator Rotation
- Assign multiple operators to each schedule
- Automatic rotation through operators in order
- Configurable assignment order
- Add/remove operators dynamically
- Rotation adjusts automatically

#### Exception Handling
- **Cancelled**: Skip specific dates (holidays, emergencies)
- **Reassigned**: Different operator for specific date (vacations, guest operators)
- **Time Change**: Modified start time or duration (special events, conflicts)
- Reason field for documentation

#### Calendar View
- Upcoming nets for next 60 days
- Shows date, time, and assigned operator
- Highlights exceptions with badges
- Real-time updates when schedules change

### Technical Details

#### Database
- Automatic table creation on server startup
- Foreign key constraints with cascade delete
- Unique constraints prevent duplicate assignments/exceptions
- Check constraints ensure valid enum values

#### API
- JWT authentication required for all endpoints
- User ID captured from token for audit trail
- Comprehensive error handling
- RESTful design patterns

#### Frontend
- React Query for server state management
- React Hook Form for form validation
- Optimistic updates for better UX
- Mobile-first responsive design

#### Algorithm
- Intelligent occurrence generation
- Day-of-week matching for weekly/bi-weekly
- Week parity calculation for bi-weekly
- Operator rotation using modulo arithmetic
- Exception priority over regular schedule

### Dependencies

No new dependencies added. Uses existing packages:
- express (backend routing)
- postgres (database)
- react-query (frontend state)
- react-hook-form (form handling)
- lucide-react (icons)

### Backward Compatibility

✅ Fully backward compatible
- No changes to existing tables
- No modifications to existing API endpoints
- New tables are independent
- Can be deployed without data migration
- Existing sessions unaffected

### Migration

No manual migration required. Database tables are created automatically on server startup.

### Testing

Manual testing checklist:
- ✅ Create schedule with all recurrence types
- ✅ Add multiple operators to schedule
- ✅ View upcoming nets in calendar
- ✅ Add all exception types
- ✅ Edit schedule details
- ✅ Remove operators and verify rotation
- ✅ Delete schedule and verify cascade
- ✅ Test mobile responsive design

### Known Limitations

1. Monthly recurrence uses day-of-month (not "2nd Tuesday" style)
2. No built-in conflict detection across schedules
3. No email notifications (planned for future)
4. No operator availability calendar (planned for future)
5. No direct integration with session creation (planned for future)

### Future Enhancements

Planned for future versions:
- Email notifications to assigned operators
- Operator availability calendar
- Conflict detection across schedules
- Session auto-creation from schedules
- Advanced recurrence patterns (Nth weekday of month)
- Export to calendar formats (iCal, Google Calendar)
- Mobile push notifications
- Operator swap requests
- Schedule templates
- Reporting and analytics

### Breaking Changes

None. This is a new feature with no breaking changes.

### Upgrade Instructions

1. Pull latest code
2. Restart server (tables will be created automatically)
3. Clear browser cache
4. Log in and navigate to "Net Schedules"
5. Create your first schedule

### Support

For questions or issues:
- Review documentation in docs/NET_SCHEDULING.md
- Check quick start guide in docs/SCHEDULING_QUICKSTART.md
- Review implementation details in SCHEDULING_IMPLEMENTATION.md
- Test API using test_schedule_api.sh

### Contributors

- Net Scheduling System implementation
- Database schema design
- Backend API development
- Frontend component development
- Documentation and testing

### Release Date

March 12, 2026

### Version Compatibility

- Requires: NetControl v1.1.0 or higher
- Node.js: 14.x or higher
- PostgreSQL: 12.x or higher
- React: 18.x or higher

---

## Summary

The Net Scheduling System is a comprehensive solution for managing recurring net operations with operator assignments and flexible exception handling. It provides:

✅ Robust recurring schedule patterns (daily, weekly, bi-weekly, monthly)
✅ Automatic operator rotation with configurable order
✅ Flexible exception handling (cancellations, reassignments, time changes)
✅ Clear visibility of upcoming nets with assigned operators
✅ Mobile-responsive interface
✅ Complete documentation and testing tools
✅ Production-ready implementation

The system integrates seamlessly with the existing NetControl application and is ready for immediate deployment.
