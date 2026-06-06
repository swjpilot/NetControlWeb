# Technical Design: Alternate Net Controller

## 1. Database Schema

### 1.1 `alternate_session_logs` Table

Stores metadata about an alternate controller's participation in a session.

```sql
CREATE TABLE IF NOT EXISTS alternate_session_logs (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  call_sign VARCHAR(20) NOT NULL,
  name VARCHAR(255),
  join_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  leave_time TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'departed', 'completed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, status) -- Only one active alternate per session
);
```

### 1.2 `alternate_session_participants` Table

Participants logged independently by the alternate controller.

```sql
CREATE TABLE IF NOT EXISTS alternate_session_participants (
  id SERIAL PRIMARY KEY,
  alternate_log_id INTEGER NOT NULL REFERENCES alternate_session_logs(id) ON DELETE CASCADE,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  operator_id INTEGER REFERENCES operators(id),
  call_sign VARCHAR(20) NOT NULL,
  name VARCHAR(255),
  check_in_time TIME,
  check_out_time TIME,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 1.3 `alternate_session_traffic` Table

Traffic messages logged independently by the alternate controller.

```sql
CREATE TABLE IF NOT EXISTS alternate_session_traffic (
  id SERIAL PRIMARY KEY,
  alternate_log_id INTEGER NOT NULL REFERENCES alternate_session_logs(id) ON DELETE CASCADE,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  from_call VARCHAR(20) NOT NULL,
  to_call VARCHAR(20) NOT NULL,
  message_number VARCHAR(50),
  precedence VARCHAR(20) DEFAULT 'Routine',
  message_text TEXT,
  time_received TIME,
  handled_by VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 1.4 `comparison_reports` Table

Persisted comparison report generated at session end.

```sql
CREATE TABLE IF NOT EXISTS comparison_reports (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  alternate_log_id INTEGER NOT NULL REFERENCES alternate_session_logs(id) ON DELETE CASCADE,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  primary_total_checkins INTEGER NOT NULL DEFAULT 0,
  primary_total_traffic INTEGER NOT NULL DEFAULT 0,
  alternate_total_checkins INTEGER NOT NULL DEFAULT 0,
  alternate_total_traffic INTEGER NOT NULL DEFAULT 0,
  match_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  total_discrepancies INTEGER NOT NULL DEFAULT 0,
  discrepancies JSONB NOT NULL DEFAULT '[]',
  summary JSONB NOT NULL DEFAULT '{}',
  comparison_scope_start TIMESTAMP,  -- NULL means from session start
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 1.5 Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_alt_session_logs_session ON alternate_session_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_alt_session_logs_user ON alternate_session_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_alt_session_logs_status ON alternate_session_logs(status);
CREATE INDEX IF NOT EXISTS idx_alt_participants_log ON alternate_session_participants(alternate_log_id);
CREATE INDEX IF NOT EXISTS idx_alt_participants_session ON alternate_session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_alt_participants_call ON alternate_session_participants(call_sign);
CREATE INDEX IF NOT EXISTS idx_alt_traffic_log ON alternate_session_traffic(alternate_log_id);
CREATE INDEX IF NOT EXISTS idx_alt_traffic_session ON alternate_session_traffic(session_id);
CREATE INDEX IF NOT EXISTS idx_alt_traffic_msg_num ON alternate_session_traffic(message_number, from_call);
CREATE INDEX IF NOT EXISTS idx_comparison_reports_session ON comparison_reports(session_id);
```

### 1.6 Settings Seed

```sql
INSERT INTO settings (key, value, description)
VALUES ('alternate_controller_enabled', 'false', 'Enable alternate net controller dual-logging feature')
ON CONFLICT (key) DO NOTHING;
```

---

## 2. API Endpoints

All endpoints are in a new route file: `server/routes/alternate-controller.js`

### 2.1 Feature Toggle

```
GET /api/settings/alternate-controller
```

**Auth:** `authenticateToken`  
**Response:**

```json
{ "enabled": true }
```

**Implementation:** Reads `alternate_controller_enabled` from the `settings` table.

---

### 2.2 Join as Alternate Controller

```
POST /api/sessions/:id/alternate/join
```

**Auth:** `authenticateToken`, `requireWrite`  
**Request Body:** _(none — user identity from JWT)_  
**Response:**

```json
{
  "success": true,
  "alternateLog": {
    "id": 1,
    "session_id": 5,
    "user_id": 3,
    "call_sign": "W1XYZ",
    "name": "John Doe",
    "join_time": "2025-01-15T19:30:00Z",
    "status": "active"
  }
}
```

**Validation:**
1. Check `alternate_controller_enabled` setting is `true` → 403 if disabled
2. Verify session exists and has no `end_time` (is active) → 404/400
3. Verify no other active alternate log exists for this session → 409
4. Verify requesting user is not the primary controller (`sessions.net_control_call` != user's call_sign) → 400
5. Create `alternate_session_logs` record with `status = 'active'`

---

### 2.3 Leave as Alternate Controller

```
POST /api/sessions/:id/alternate/leave
```

**Auth:** `authenticateToken`, `requireWrite`  
**Response:**

```json
{
  "success": true,
  "message": "Left alternate controller role",
  "alternateLog": { "id": 1, "leave_time": "2025-01-15T20:15:00Z", "status": "departed" }
}
```

**Logic:**
1. Find active alternate log for this session where `user_id = req.user.userId`
2. Set `leave_time = CURRENT_TIMESTAMP`, `status = 'departed'`
3. Preserve all logged data — no deletions

---

### 2.4 Add Participant to Alternate Log

```
POST /api/sessions/:id/alternate/participants
```

**Auth:** `authenticateToken`, `requireWrite`  
**Request Body:**

```json
{
  "call_sign": "KD7ABC",
  "name": "Jane Smith",
  "check_in_time": "19:35",
  "operator_id": 12,
  "notes": ""
}
```

**Response:**

```json
{
  "success": true,
  "participant": { "id": 7, "call_sign": "KD7ABC", "name": "Jane Smith", "check_in_time": "19:35" }
}
```

**Validation:**
1. Verify caller has an active alternate log for this session
2. Insert into `alternate_session_participants`

---

### 2.5 Add Traffic to Alternate Log

```
POST /api/sessions/:id/alternate/traffic
```

**Auth:** `authenticateToken`, `requireWrite`  
**Request Body:**

```json
{
  "from_call": "W1ABC",
  "to_call": "KD7XYZ",
  "message_number": "NR-042",
  "precedence": "Routine",
  "message_text": "Meeting moved to Thursday",
  "time_received": "19:45",
  "handled_by": "W1XYZ",
  "notes": ""
}
```

**Response:**

```json
{
  "success": true,
  "traffic": { "id": 3, "from_call": "W1ABC", "to_call": "KD7XYZ", "message_number": "NR-042" }
}
```

**Validation:**
1. Verify caller has an active alternate log for this session
2. Insert into `alternate_session_traffic`

---

### 2.6 Get Alternate Log Data

```
GET /api/sessions/:id/alternate/log
```

**Auth:** `authenticateToken`  
**Response:**

```json
{
  "alternateLog": {
    "id": 1,
    "session_id": 5,
    "user_id": 3,
    "call_sign": "W1XYZ",
    "name": "John Doe",
    "join_time": "2025-01-15T19:30:00Z",
    "leave_time": null,
    "status": "active"
  },
  "participants": [
    { "id": 7, "call_sign": "KD7ABC", "name": "Jane Smith", "check_in_time": "19:35" }
  ],
  "traffic": [
    { "id": 3, "from_call": "W1ABC", "to_call": "KD7XYZ", "message_number": "NR-042" }
  ],
  "sessionMeta": {
    "session_date": "2025-01-15",
    "net_control_call": "W9ABC",
    "frequency": "146.520",
    "mode": "FM",
    "start_time": "19:00"
  }
}
```

**Logic:**
- Returns the alternate log (any status) for this session
- Includes session metadata as read-only context
- If the caller is the alternate controller, shows their full data
- If the caller is not the alternate, returns 404 or the log (admin/primary can view)

---

### 2.7 Generate Comparison Report

```
POST /api/sessions/:id/comparison/generate
```

**Auth:** `authenticateToken`, `requireWrite`  
**Response:**

```json
{
  "success": true,
  "report": {
    "id": 1,
    "session_id": 5,
    "match_percentage": 87.5,
    "total_discrepancies": 3,
    "primary_total_checkins": 12,
    "alternate_total_checkins": 11,
    "primary_total_traffic": 4,
    "alternate_total_traffic": 4,
    "discrepancies": [...],
    "summary": {...}
  }
}
```

**Logic:** See Section 4 (Data Flow) for the matching algorithm.

---

### 2.8 Get Comparison Report

```
GET /api/sessions/:id/comparison
```

**Auth:** `authenticateToken`  
**Response:** Same structure as generate, or 404 if no report exists.

---

## 3. Frontend Components

### 3.1 `AlternateControllerPanel`

**File:** `client/src/components/AlternateControllerPanel.js`

A panel displayed when the user has joined a session as the alternate controller. Mirrors the primary session logging UI but writes to alternate endpoints.

**Key behaviors:**
- Shows session metadata (frequency, mode, date, net control) as read-only header
- Provides a participant add form identical to the primary (call sign autocomplete, name, check-in time)
- Provides a traffic add form identical to the primary (from, to, message number, precedence, text)
- Lists currently logged alternate participants and traffic in tables
- Uses `react-query` mutations pointing at `/api/sessions/:id/alternate/participants` and `/api/sessions/:id/alternate/traffic`
- Shows a "Leave Session" button that calls `/api/sessions/:id/alternate/leave`

**Hooks/queries:**
```js
const { data: altLog } = useQuery(
  ['alternate-log', sessionId],
  () => axios.get(`/api/sessions/${sessionId}/alternate/log`).then(r => r.data)
);

const addParticipant = useMutation(
  (data) => axios.post(`/api/sessions/${sessionId}/alternate/participants`, data),
  { onSuccess: () => queryClient.invalidateQueries(['alternate-log', sessionId]) }
);

const addTraffic = useMutation(
  (data) => axios.post(`/api/sessions/${sessionId}/alternate/traffic`, data),
  { onSuccess: () => queryClient.invalidateQueries(['alternate-log', sessionId]) }
);
```

### 3.2 `NetSummaryPopup`

**File:** `client/src/components/NetSummaryPopup.js`

A Bootstrap modal shown at session end when an alternate log exists.

**Layout:**
```
┌────────────────────────────────────────────────────────┐
│  Net Session Summary                            [X]    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Match: 87.5%          ███████████░░░ 87.5%           │
│                                                        │
│  ┌─────────────────┬──────────────────┐               │
│  │   Primary Log    │  Alternate Log   │               │
│  ├─────────────────┼──────────────────┤               │
│  │  Check-ins: 12   │  Check-ins: 11   │               │
│  │  Traffic: 4      │  Traffic: 4      │               │
│  │  Duration: 1h15m │  Time joined: 55m│               │
│  └─────────────────┴──────────────────┘               │
│                                                        │
│  Discrepancies: 3 items                                │
│  • 1 missed participant                                │
│  • 1 check-in time difference                          │
│  • 1 traffic detail mismatch                           │
│                                                        │
│  [View Full Report]              [Dismiss]             │
└────────────────────────────────────────────────────────┘
```

**Props:**
```js
{
  show: boolean,
  onClose: () => void,
  sessionId: number,
  comparisonReport: object  // from /api/sessions/:id/comparison
}
```

### 3.3 `ComparisonReport`

**File:** `client/src/pages/ComparisonReport.js`

A full-page view (accessible via route `/sessions/:id/comparison`) showing detailed discrepancies.

**Sections:**
1. **Summary header** — match percentage, totals, session info
2. **Participant discrepancies** — table showing:
   - Participants in primary but not alternate (highlighted red)
   - Participants in alternate but not primary (highlighted yellow)
   - Check-in time differences for matched participants
3. **Traffic discrepancies** — table showing:
   - Traffic in primary but not alternate
   - Traffic in alternate but not primary
   - Detail differences (precedence, message text, handled_by) for matched entries
4. **Legend** — color coding explanation

**Query:**
```js
const { data: report } = useQuery(
  ['comparison-report', sessionId],
  () => axios.get(`/api/sessions/${sessionId}/comparison`).then(r => r.data)
);
```

### 3.4 Feature Toggle in Admin Settings

Add to the existing Settings page (likely `client/src/pages/Settings.js`) under a "Features" section:

```jsx
<div className="mb-3">
  <label className="form-label">Alternate Net Controller</label>
  <div className="form-check form-switch">
    <input
      className="form-check-input"
      type="checkbox"
      checked={getSetting('alternate_controller_enabled') === 'true'}
      onChange={(e) => updateSetting('alternate_controller_enabled', e.target.checked ? 'true' : 'false')}
    />
    <label className="form-check-label">
      Enable dual-logging verification (allows a second controller to independently log session data)
    </label>
  </div>
</div>
```

### 3.5 Session View Integration

In the active session view, add a conditional "Join as Alternate" button:

```jsx
{featureEnabled && !isAlternate && !isPrimaryController && !hasAlternate && (
  <button className="btn btn-outline-secondary" onClick={handleJoinAlternate}>
    <Users size={16} className="me-1" />
    Join as Alternate Controller
  </button>
)}

{isAlternate && (
  <AlternateControllerPanel sessionId={sessionId} />
)}
```

---

## 4. Data Flow

### 4.1 Joining as Alternate Controller

```
User clicks "Join as Alternate Controller"
  → POST /api/sessions/:id/alternate/join
  → Server validates:
      - Feature enabled? (settings table lookup)
      - Session active? (no end_time)
      - No existing active alternate? (query alternate_session_logs)
      - User != primary controller? (compare call signs)
  → INSERT INTO alternate_session_logs (session_id, user_id, call_sign, name, join_time, status)
  → Return alternate log record
  → Frontend switches to AlternateControllerPanel
```

### 4.2 Logging Data (Alternate)

```
Alternate controller adds a participant:
  → POST /api/sessions/:id/alternate/participants
  → Server looks up active alternate_session_logs for (session_id, user_id)
  → INSERT INTO alternate_session_participants (alternate_log_id, session_id, call_sign, ...)
  → Return new participant record
  → Frontend updates participant list via react-query invalidation
```

Same pattern for traffic — writes to `alternate_session_traffic`.

### 4.3 Comparison Report Generation

Triggered when the primary controller ends the session (existing "End Net" flow):

```
Primary clicks "End Net"
  → Existing end-session logic (set end_time on sessions table)
  → Server checks: does an alternate_session_logs record exist for this session?
  → If yes:
      1. Mark alternate log status = 'completed', set leave_time if not already set
      2. Run comparison algorithm (see 4.4)
      3. INSERT INTO comparison_reports
      4. Return comparison summary in end-session response
  → Frontend detects comparison report in response → shows NetSummaryPopup
```

### 4.4 Matching Algorithm

**Participant matching:**
- Key: `UPPER(call_sign)`
- For each participant in primary log:
  - Find matching call_sign in alternate log
  - If not found → discrepancy: "Missing from alternate"
- For each participant in alternate log:
  - Find matching call_sign in primary log
  - If not found → discrepancy: "Extra in alternate / Missing from primary"
- For matched participants:
  - Compare `check_in_time` — if difference > 2 minutes → discrepancy: "Time difference"

**Traffic matching:**
- Composite key: `UPPER(from_call) + message_number`
- For each traffic entry in primary log:
  - Find matching entry in alternate log by composite key
  - If not found → discrepancy: "Missing from alternate"
- For each traffic entry in alternate log:
  - Find matching entry in primary log
  - If not found → discrepancy: "Extra in alternate"
- For matched traffic entries:
  - Compare `precedence`, `message_text`, `handled_by`, `to_call`
  - Each differing field → discrepancy with field name and both values

**Mid-session scope filtering:**
- If `alternate_session_logs.join_time > sessions.start_time`:
  - Only include primary participants with `check_in_time >= alternate join_time` (converted to TIME)
  - Only include primary traffic with `time_received >= alternate join_time`
  - Store `comparison_scope_start` on the report

### 4.5 Match Percentage Calculation

```
total_comparable_items = max(primary_participants + primary_traffic, alternate_participants + alternate_traffic)

if total_comparable_items == 0:
  match_percentage = 100.0

matched_items = items that exist in both logs with no field-level discrepancies
match_percentage = (matched_items / total_comparable_items) * 100
```

Rounded to 2 decimal places, capped at 0.00–100.00.

---

## 5. Integration Points

### 5.1 "End Net" Button Integration

The existing session end flow needs modification:

```js
// In the end-session route handler (server/routes/sessions.js or similar)
router.post('/:id/end', authenticateToken, requireWrite, async (req, res) => {
  // ... existing end logic (set end_time, update totals) ...

  // NEW: Check for alternate log and generate comparison
  const altLog = await db.sql`
    SELECT * FROM alternate_session_logs 
    WHERE session_id = ${id} AND status IN ('active', 'departed')
    LIMIT 1
  `;

  let comparisonReport = null;
  if (altLog.length > 0) {
    // Mark alternate log as completed
    await db.sql`
      UPDATE alternate_session_logs 
      SET status = 'completed', 
          leave_time = COALESCE(leave_time, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${altLog[0].id}
    `;

    // Generate comparison report
    comparisonReport = await generateComparisonReport(id, altLog[0]);
  }

  res.json({
    success: true,
    session: updatedSession,
    comparisonReport  // null if no alternate was present
  });
});
```

On the frontend, the end-session mutation's `onSuccess` handler checks for `comparisonReport`:

```js
const endSessionMutation = useMutation(
  () => axios.post(`/api/sessions/${sessionId}/end`),
  {
    onSuccess: (response) => {
      if (response.data.comparisonReport) {
        setShowSummaryPopup(true);
        setComparisonData(response.data.comparisonReport);
      }
      queryClient.invalidateQueries(['session', sessionId]);
      toast.success('Net session ended');
    }
  }
);
```

### 5.2 Feature Toggle Integration

**API layer:** A helper function used by all alternate endpoints:

```js
async function checkFeatureEnabled() {
  const result = await db.sql`
    SELECT value FROM settings WHERE key = 'alternate_controller_enabled'
  `;
  return result.length > 0 && result[0].value === 'true';
}
```

**Frontend layer:** A custom hook wrapping the settings check:

```js
const useAlternateControllerEnabled = () => {
  const { data } = useQuery(
    'alternate-controller-enabled',
    () => axios.get('/api/settings/alternate-controller').then(r => r.data.enabled),
    { staleTime: 60000 }
  );
  return data ?? false;
};
```

When `false`:
- "Join as Alternate" button is hidden
- Alternate API endpoints return 403 with message "Alternate controller feature is disabled"
- Session end does not attempt alternate comparison
- Comparison report links are hidden

### 5.3 Mid-Session Join Handling

When an alternate joins mid-session:

1. **On join:** The server returns the current session's participant list as read-only context in the join response:
   ```js
   const currentParticipants = await db.sql`
     SELECT call_sign, name, check_in_time 
     FROM session_participants 
     WHERE session_id = ${sessionId}
     ORDER BY check_in_time
   `;
   ```
   Frontend displays these in a "Current Participants (read-only)" section above the alternate's own log.

2. **On comparison:** The `comparison_scope_start` is set to the alternate's `join_time`. Only primary log entries timestamped at or after this time are included in the comparison. Entries before the join are excluded and noted in the report summary:
   ```json
   {
     "summary": {
       "scope": "partial",
       "scope_start": "2025-01-15T19:30:00Z",
       "excluded_primary_participants": 4,
       "excluded_primary_traffic": 1
     }
   }
   ```

### 5.4 Real-Time Considerations

The current app uses HTTP polling via `react-query` refetch intervals. The alternate controller's view of session state uses the same pattern:
- `refetchInterval: 10000` on the alternate log query to stay in sync with session state changes
- When the primary ends the session, the alternate's next poll detects `status = 'completed'` and displays the summary popup

### 5.5 Route Registration

In `server/index.js` (or wherever routes are mounted):

```js
const alternateControllerRoutes = require('./routes/alternate-controller');
app.use('/api/sessions', alternateControllerRoutes);
```

The settings endpoint for the toggle uses the existing settings route pattern or is co-located:

```js
// In alternate-controller.js or settings route
router.get('/settings/alternate-controller', authenticateToken, async (req, res) => {
  const result = await db.sql`
    SELECT value FROM settings WHERE key = 'alternate_controller_enabled'
  `;
  const enabled = result.length > 0 && result[0].value === 'true';
  res.json({ enabled });
});
```

---

## 6. Error Handling & Resilience

Per Requirement 10.4, failures in alternate controller functionality must not disrupt primary session operations:

```js
// Wrap alternate operations in try/catch at the integration boundary
try {
  const altLog = await db.sql`SELECT * FROM alternate_session_logs WHERE session_id = ${id}`;
  if (altLog.length > 0) {
    comparisonReport = await generateComparisonReport(id, altLog[0]);
  }
} catch (altError) {
  console.error('Alternate controller comparison failed (non-fatal):', altError);
  // Continue — primary session end succeeds regardless
}
```

Table creation is wrapped similarly — if `alternate_session_logs` fails to create, the app logs the error and continues operating without the feature.
