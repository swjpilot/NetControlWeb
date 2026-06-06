#!/bin/bash

# Test script for Net Scheduling API
# This script tests the basic functionality of the scheduling endpoints

BASE_URL="http://localhost:5000/api"
TOKEN=""

echo "=== Net Scheduling API Test ==="
echo ""
echo "Note: You need to be logged in and have a valid token"
echo "This script demonstrates the API structure"
echo ""

# Example: Create a schedule
echo "1. Create Schedule Example:"
cat << 'JSON'
POST /api/schedules
{
  "name": "Tuesday Evening 2m Net",
  "description": "Weekly 2-meter net on Tuesday evenings",
  "frequency": "146.520 MHz",
  "mode": "FM",
  "net_type": "Regular",
  "start_time": "19:00",
  "duration_minutes": 60,
  "recurrence_type": "weekly",
  "days_of_week": "2",
  "start_date": "2026-03-17",
  "active": true
}
JSON

echo ""
echo "2. Add Assignment Example:"
cat << 'JSON'
POST /api/schedules/1/assignments
{
  "user_id": 1,
  "call_sign": "W1ABC",
  "name": "John Doe",
  "assignment_order": 1
}
JSON

echo ""
echo "3. Add Exception Example:"
cat << 'JSON'
POST /api/schedules/1/exceptions
{
  "exception_date": "2026-03-24",
  "exception_type": "reassigned",
  "assigned_user_id": 2,
  "assigned_call_sign": "K2DEF",
  "assigned_name": "Jane Smith",
  "reason": "Regular operator on vacation"
}
JSON

echo ""
echo "4. Get Upcoming Nets:"
echo "GET /api/schedules/calendar/upcoming?days=30"

echo ""
echo "=== Test Complete ==="
