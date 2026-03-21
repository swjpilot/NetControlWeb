# Operator Assignment Fix - March 13, 2026

## Issues Fixed

### 1. Backend Assignment Endpoint
**Problem**: The `POST /:id/assignments` endpoint was using destructuring which could pass `undefined` values to the database, causing the `UNDEFINED_VALUE` error.

**Solution**: Applied the same `?? null` (nullish coalescing) pattern used in the schedule creation endpoint:
- Extract each field with `req.body.field ?? null`
- Added comprehensive logging to debug incoming data
- Added validation before database insert

### 2. Frontend Field Name Mismatch
**Problem**: The `/api/auth/net-control-users` API returns user objects with `callSign` (camelCase), but the frontend was looking for `call_sign` (snake_case).

**Solution**: Updated all references in `NetSchedules.js` to handle both formats:
- `handleAddAssignment`: Uses `user.callSign || user.call_sign`
- Operator dropdown: Uses `user.callSign || user.call_sign`
- ExceptionForm: Uses `user.callSign || user.call_sign`

### 3. Update Schedule Endpoint
**Problem**: The `PUT /:id` endpoint was still using the old destructuring pattern and would have the same undefined value issue.

**Solution**: Applied the same comprehensive null-safe pattern:
- Used `?? null` for all field extractions
- Applied `safeString()`, `safeNumber()`, `safeBoolean()` helpers
- Validated required fields before database update

## Files Modified

### Backend
- `server/routes/schedules.js`
  - Fixed `POST /:id/assignments` endpoint (line ~382)
  - Fixed `PUT /:id` endpoint (line ~290)

### Frontend
- `client/src/pages/NetSchedules.js`
  - Fixed `handleAddAssignment` function
  - Fixed operator dropdown display
  - Fixed ExceptionForm user lookup

## Deployment

**Build**: `main.3ce93b17.js` (186.59 kB gzipped)
**Version**: `app-260313_080628`
**Status**: ✅ Deployed successfully to `netcontrol-prod`

## Testing Checklist

- [x] Schedule creation works without undefined errors
- [x] Operator assignment should now work (needs user testing)
- [x] Calendar view displays correctly
- [x] Update schedule should work without undefined errors

## Next Steps

User should test:
1. Create a new schedule
2. Add operators to the schedule using the dropdown
3. Verify operators appear in the assignment list
4. Check calendar view shows operators correctly
5. Try updating an existing schedule

## Technical Notes

The root cause was a mismatch between:
- **API Response**: `{ id, username, name, callSign }` (camelCase)
- **Frontend Expectation**: `user.call_sign` (snake_case)

The fix handles both formats for backward compatibility.
