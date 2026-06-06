# Implementation Tasks

## Phase 1: Database & Settings

- [ ] 1. Add `alternate_session_logs` CREATE TABLE statement to database initialization (server/database/postgres-js-db.js)
- [ ] 2. Add `alternate_session_participants` CREATE TABLE statement to database initialization (server/database/postgres-js-db.js)
- [ ] 3. Add `alternate_session_traffic` CREATE TABLE statement to database initialization (server/database/postgres-js-db.js)
- [ ] 4. Add `comparison_reports` CREATE TABLE statement to database initialization (server/database/postgres-js-db.js)
- [ ] 5. Add indexes for all alternate controller tables (idx_alt_session_logs_session, idx_alt_session_logs_user, idx_alt_session_logs_status, idx_alt_participants_log, idx_alt_participants_session, idx_alt_participants_call, idx_alt_traffic_log, idx_alt_traffic_session, idx_alt_traffic_msg_num, idx_comparison_reports_session)
- [ ] 6. Add `alternate_controller_enabled` default setting (`false`) to the settings seed array (server/database/postgres-js-db.js)

## Phase 2: Backend API

- [ ] 7. Create `server/routes/alternate-controller.js` with route scaffolding and shared `checkFeatureEnabled` helper function
- [ ] 8. Implement `GET /api/settings/alternate-controller` endpoint — reads feature toggle from settings table
- [ ] 9. Implement `POST /api/sessions/:id/alternate/join` endpoint — validates feature enabled, session active, no existing alternate, user is not primary; creates alternate_session_logs record
- [ ] 10. Implement `POST /api/sessions/:id/alternate/leave` endpoint — sets leave_time and status to 'departed' on caller's active alternate log
- [ ] 11. Implement `POST /api/sessions/:id/alternate/participants` endpoint — validates caller has active alternate log, inserts into alternate_session_participants
- [ ] 12. Implement `POST /api/sessions/:id/alternate/traffic` endpoint — validates caller has active alternate log, inserts into alternate_session_traffic
- [ ] 13. Implement `GET /api/sessions/:id/alternate/log` endpoint — returns alternate log, participants, traffic, and session metadata
- [ ] 14. Implement `generateComparisonReport` helper function — participant matching by call_sign, traffic matching by from_call + message_number, mid-session scope filtering, match percentage calculation
- [ ] 15. Implement `POST /api/sessions/:id/comparison/generate` endpoint — calls generateComparisonReport and persists to comparison_reports table
- [ ] 16. Implement `GET /api/sessions/:id/comparison` endpoint — returns persisted comparison report or 404
- [ ] 17. Register alternate-controller routes in server/index.js (`app.use('/api/sessions', alternateControllerRoutes)`)

## Phase 3: Frontend Components

- [ ] 18. Create `useAlternateControllerEnabled` hook (client/src/hooks/useAlternateControllerEnabled.js) — queries `GET /api/settings/alternate-controller` with 60s staleTime
- [ ] 19. Create `AlternateControllerPanel` component (client/src/components/AlternateControllerPanel.js) — participant add form, traffic add form, logged data tables, leave button, session metadata header, react-query mutations
- [ ] 20. Create `NetSummaryPopup` modal component (client/src/components/NetSummaryPopup.js) — Bootstrap modal showing match percentage, side-by-side totals, discrepancy summary, "View Full Report" and "Dismiss" buttons
- [ ] 21. Create `ComparisonReport` page component (client/src/pages/ComparisonReport.js) — full detail view with participant discrepancies table, traffic discrepancies table, summary header, legend
- [ ] 22. Add route for `/sessions/:id/comparison` in the client router configuration
- [ ] 23. Add "Join as Alternate Controller" button to active session view — conditional on feature enabled, user is not primary, no existing alternate
- [ ] 24. Add feature toggle switch to admin Settings page under a "Features" section — checkbox for `alternate_controller_enabled`

## Phase 4: Integration & End Session Flow

- [ ] 25. Modify the end-session route handler to check for alternate log, mark it completed, call `generateComparisonReport`, and include `comparisonReport` in the response
- [ ] 26. Modify the frontend end-session mutation `onSuccess` to detect `comparisonReport` in response and show `NetSummaryPopup`
- [ ] 27. Add alternate controller status indicator to the active session header (shows who is the alternate controller if one is active)
- [ ] 28. Handle the alternate's view when session is ended by primary — poll detects `status = 'completed'`, display NetSummaryPopup with comparison data

## Phase 5: Polish & Testing

- [ ] 29. Add comparison report link/tab to the session detail view for completed sessions that have a comparison report
- [ ] 30. Add visual indicator on session list for sessions that have associated comparison reports
- [ ] 31. Add error handling and graceful degradation if alternate controller tables don't exist — wrap alternate operations in try/catch, log errors, allow primary flow to continue
- [ ] 32. Ensure the feature toggle hides all alternate controller UI elements when `alternate_controller_enabled` is `false`
