# Monthly Net Control Reports Feature

## Overview
Comprehensive monthly reporting system for net controller activity and check-in statistics.

## Features

### Report Sections

#### 1. Net Controller Summary
- Lists all net controllers alphabetically by call sign
- Shows total sessions conducted
- Shows total check-ins received
- Calculates average check-ins per session
- Includes grand totals

#### 2. Detailed Breakdown by Controller
- Groups sessions by net controller (alphabetically)
- Shows each session date and check-in count
- Provides subtotals for each controller
- Easy to see performance across multiple sessions

#### 3. Chronological Session List
- All sessions ordered by date
- Shows net controller and check-in count for each date
- Useful for tracking daily activity

#### 4. Period Statistics
- **General Statistics:**
  - Total sessions
  - Unique net controllers
  - Total check-ins
  - Average check-ins per session
  - Maximum check-ins (single session)
  - Minimum check-ins (single session)

- **Best & Worst Sessions:**
  - Highlights the session with most check-ins
  - Shows the session with lowest attendance
  - Includes date, controller, and check-in count

### User Interface Features

#### Date Selection
- Custom date range picker
- Quick buttons for "Current Month" and "Last Month"
- Defaults to current month on page load

#### Report Generation
- "Generate Report" button to fetch data
- Loading indicator during data fetch
- Error handling with toast notifications

#### Export Options
- "Print/PDF" button for printing or saving as PDF
- Print-optimized layout (hides controls, adjusts formatting)
- Professional report header and footer

#### Visual Design
- Statistics cards with icons showing key metrics
- Color-coded tables for easy reading
- Responsive layout for all screen sizes
- Subtotals and totals clearly marked
- Alert boxes for best/worst sessions

## Technical Implementation

### Backend (`server/routes/reports.js`)
- **Endpoint:** `GET /api/reports/monthly-net-control`
- **Parameters:** `start_date`, `end_date`
- **Returns:** Comprehensive report object with 4 sections

**SQL Queries:**
1. Controller summary with aggregated totals
2. Detailed breakdown grouped by controller and date
3. Chronological list ordered by date
4. Statistics calculations including averages and extremes

### Frontend (`client/src/pages/Reports.js`)
- React component with React Query for data fetching
- Date range selection with helper buttons
- Print-friendly CSS for PDF generation
- Responsive Bootstrap layout
- Icon-based statistics cards

### Navigation
- Added to main navigation menu as "Reports"
- Route: `/reports`
- Available to all authenticated users

## Usage

1. Navigate to "Reports" in the main menu
2. Select date range (or use quick buttons)
3. Click "Generate Report"
4. Review the four report sections
5. Click "Print/PDF" to export

## Use Cases

### Monthly Club Reports
- Generate at end of each month
- Share with club members
- Track net controller participation

### Performance Analysis
- Identify most active controllers
- See attendance trends
- Recognize top performers

### Planning & Scheduling
- Understand typical check-in counts
- Plan for operator rotation
- Identify low-attendance periods

### Record Keeping
- Maintain historical records
- Document club activity
- Support grant applications or reports

## Report Output Example

```
Net Control Activity Report
Period: 3/1/2026 - 3/31/2026

Statistics Overview:
- 28 Total Sessions
- 5 Net Controllers
- 342 Total Check-ins
- 12.2 Avg Check-ins/Session

Section 1: Controller Summary
Call Sign | Name        | Sessions | Total Check-ins | Avg
W1ABC     | John Smith  | 8        | 96             | 12.0
K2XYZ     | Jane Doe    | 7        | 91             | 13.0
...

Section 2: Detailed Breakdown
W1ABC - John Smith
  3/1/2026  - 11 check-ins
  3/8/2026  - 13 check-ins
  ...
  Subtotal: 96 check-ins

Section 3: Chronological List
3/1/2026  | W1ABC | John Smith  | 11
3/2/2026  | K2XYZ | Jane Doe    | 13
...

Section 4: Statistics
Best Session: 3/15/2026 - W1ABC - 18 check-ins
Lowest Attendance: 3/22/2026 - K2XYZ - 6 check-ins
```

## Files Created/Modified

### New Files
- `server/routes/reports.js` - Backend API endpoint
- `client/src/pages/Reports.js` - Frontend report component

### Existing Files (Already Configured)
- `server/index.js` - Reports route already registered
- `client/src/App.js` - Reports route already defined
- `client/src/components/Layout.js` - Reports menu item already added

## Deployment

**Build**: `main.639bb114.js` (183.12 kB gzipped, -4.15 kB)
**Version**: `app-260313_084541`
**Status**: ✅ Deployed successfully to `netcontrol-prod`

## Future Enhancements

Potential additions:
- Export to CSV/Excel
- Email report scheduling
- Year-over-year comparisons
- Graphical charts and visualizations
- Filter by net type or frequency
- Custom report templates
- Operator performance badges
