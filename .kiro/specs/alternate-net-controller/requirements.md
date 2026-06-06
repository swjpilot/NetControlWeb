# Requirements Document

## Introduction

The Alternate Net Controller feature adds a dual-logging verification system to NetControl. It allows a second net controller to independently log the same session data (participants, check-ins, traffic) alongside the primary net controller. At the end of the session, the two independent logs are compared to produce a difference report highlighting discrepancies. This feature is optional and can be enabled or disabled per-net in the application settings.

## Glossary

- **NetControl**: The ham radio net control logging application
- **Primary_Controller**: The net controller who creates and owns the session, whose log is the official record
- **Alternate_Controller**: A second authenticated user who joins an active session to independently log the same data for verification purposes
- **Session**: A net control session record containing participants, check-ins, and traffic messages
- **Alternate_Log**: The independent set of participants, check-ins, and traffic recorded by the Alternate_Controller for a given session
- **Comparison_Report**: A report generated at session end that identifies differences between the Primary_Controller log and the Alternate_Log
- **Settings_Service**: The application settings management subsystem (admin-only configuration)
- **Discrepancy**: A difference between the Primary_Controller log and the Alternate_Log (e.g., a missed check-in, differing time, extra or missing traffic entry)
- **Net_Summary_Popup**: A modal dialog displayed to both controllers at session end showing totals, comparison highlights, and a match percentage

## Requirements

### Requirement 1: Feature Toggle

**User Story:** As an admin, I want to enable or disable the alternate net controller feature in settings, so that nets which do not use dual-logging are not impacted.

#### Acceptance Criteria

1. THE Settings_Service SHALL provide a setting with key `alternate_controller_enabled` that accepts values `true` or `false`
2. WHEN `alternate_controller_enabled` is set to `false`, THE NetControl SHALL hide all alternate controller UI elements and reject alternate controller join requests
3. WHEN `alternate_controller_enabled` is set to `true`, THE NetControl SHALL display the alternate controller UI elements and allow alternate controller join requests
4. THE Settings_Service SHALL default the `alternate_controller_enabled` setting to `false` upon initial installation

### Requirement 2: Alternate Controller Session Join

**User Story:** As an alternate net controller, I want to join an active session so that I can independently log the same data as the primary controller.

#### Acceptance Criteria

1. WHEN an authenticated user requests to join a session as an alternate controller, THE NetControl SHALL create an Alternate_Log record linked to the session and the user
2. WHEN a session already has an Alternate_Controller assigned, THE NetControl SHALL reject additional alternate controller join requests for that session
3. WHEN a user attempts to join a session as alternate controller while `alternate_controller_enabled` is `false`, THE NetControl SHALL return an error indicating the feature is disabled
4. THE NetControl SHALL prevent the Primary_Controller from simultaneously being the Alternate_Controller on the same session
5. WHEN an Alternate_Controller joins a session, THE NetControl SHALL record the join timestamp on the Alternate_Log

### Requirement 3: Independent Alternate Logging

**User Story:** As an alternate net controller, I want to independently log participants, check-ins, and traffic for the session, so that my log can be compared against the primary controller's log.

#### Acceptance Criteria

1. WHILE an Alternate_Controller is joined to a session, THE NetControl SHALL allow the Alternate_Controller to add participants to the Alternate_Log independently from the Primary_Controller log
2. WHILE an Alternate_Controller is joined to a session, THE NetControl SHALL allow the Alternate_Controller to record check-in times for participants in the Alternate_Log
3. WHILE an Alternate_Controller is joined to a session, THE NetControl SHALL allow the Alternate_Controller to add traffic messages to the Alternate_Log independently from the Primary_Controller log
4. THE NetControl SHALL store the Alternate_Log data in separate database tables from the primary session data
5. WHILE an Alternate_Controller is joined to a session, THE NetControl SHALL display the session metadata (frequency, mode, date, net control call) as read-only to the Alternate_Controller

### Requirement 4: Alternate Controller Session Departure

**User Story:** As an alternate net controller, I want to leave a session before it ends, so that my partial log is preserved for comparison.

#### Acceptance Criteria

1. WHEN an Alternate_Controller leaves a session before the session ends, THE NetControl SHALL record the departure timestamp on the Alternate_Log
2. WHEN an Alternate_Controller leaves a session, THE NetControl SHALL preserve all data in the Alternate_Log for later comparison
3. WHEN an Alternate_Controller has departed, THE NetControl SHALL allow a different user to join the session as an Alternate_Controller

### Requirement 5: Mid-Session Join Handling

**User Story:** As an alternate net controller, I want to join an active session that has already started, so that I can log the remainder of the session even if I was not present from the beginning.

#### Acceptance Criteria

1. WHEN an Alternate_Controller joins a session that already has participants logged by the Primary_Controller, THE NetControl SHALL display the current session participant list as read-only context to the Alternate_Controller
2. WHEN an Alternate_Controller joins mid-session, THE NetControl SHALL record only the data logged by the Alternate_Controller from the join point forward in the Alternate_Log
3. WHEN generating the Comparison_Report for a mid-session join, THE NetControl SHALL only compare data from after the Alternate_Controller join timestamp

### Requirement 6: Comparison Report Generation

**User Story:** As a net controller, I want to see a comparison of the primary log and alternate log after a session ends, so that discrepancies can be identified and reviewed.

#### Acceptance Criteria

1. WHEN a session that has an Alternate_Log is ended, THE NetControl SHALL generate a Comparison_Report
2. THE Comparison_Report SHALL identify participants present in the Primary_Controller log but absent from the Alternate_Log
3. THE Comparison_Report SHALL identify participants present in the Alternate_Log but absent from the Primary_Controller log
4. THE Comparison_Report SHALL identify check-in time differences between the two logs for matching participants
5. THE Comparison_Report SHALL identify traffic messages present in one log but absent from the other
6. THE Comparison_Report SHALL identify differences in traffic message details (precedence, message text, handled_by) for matching traffic entries
7. THE Comparison_Report SHALL match participants across logs using call sign as the key
8. THE Comparison_Report SHALL match traffic messages across logs using message number and from_call as the composite key
9. THE Comparison_Report SHALL persist in the database and be accessible after session completion

### Requirement 7: Comparison Report Viewing

**User Story:** As an admin or net controller, I want to view the comparison report for any completed session that used an alternate controller, so that I can review discrepancies.

#### Acceptance Criteria

1. WHEN a user views a session that has an associated Comparison_Report, THE NetControl SHALL display a link or tab to access the report
2. THE Comparison_Report view SHALL display discrepancies grouped by category (participants, check-in times, traffic)
3. THE Comparison_Report view SHALL clearly indicate which log (primary or alternate) contains each differing entry
4. THE Comparison_Report view SHALL display a summary count of total discrepancies found

### Requirement 8: Primary Log Remains Official Record

**User Story:** As a net admin, I want the primary controller's log to remain the official session record, so that the alternate log serves only as a verification tool.

#### Acceptance Criteria

1. THE NetControl SHALL treat the Primary_Controller log as the authoritative session record for all reporting and export functions
2. THE NetControl SHALL clearly label the Alternate_Log as supplementary verification data in all views
3. WHEN discrepancies exist, THE NetControl SHALL flag the session for review without modifying the Primary_Controller log

### Requirement 9: Net Summary Popup at Session End

**User Story:** As a net controller (primary or alternate), I want to see a popup summary screen when the net concludes, so that both controllers can immediately review their results and any discrepancies side by side.

#### Acceptance Criteria

1. WHEN a session with an active Alternate_Controller is ended, THE NetControl SHALL display a modal summary popup to both the Primary_Controller and the Alternate_Controller
2. THE summary popup SHALL display the Primary_Controller's totals (total check-ins, total traffic, session duration)
3. THE summary popup SHALL display the Alternate_Controller's totals (total check-ins, total traffic, time joined)
4. THE summary popup SHALL display a side-by-side comparison highlighting discrepancies between the two logs
5. THE summary popup SHALL display a match percentage indicating how closely the two logs agree
6. THE summary popup SHALL provide a button to view the full Comparison_Report detail
7. THE summary popup SHALL provide a button to dismiss and close the popup
8. WHEN `alternate_controller_enabled` is `false` or no Alternate_Controller was present, THE NetControl SHALL display the standard session summary without dual-log comparison

### Requirement 10: Data Isolation

**User Story:** As a developer, I want the alternate log data to be stored separately from primary session data, so that existing session functionality is not affected.

#### Acceptance Criteria

1. THE NetControl SHALL store alternate participant records in an `alternate_session_participants` table separate from `session_participants`
2. THE NetControl SHALL store alternate traffic records in an `alternate_session_traffic` table separate from `session_traffic`
3. THE NetControl SHALL store alternate session metadata in an `alternate_session_logs` table linking the alternate log to the session and user
4. IF the alternate controller tables fail to be created or accessed, THEN THE NetControl SHALL log the error and continue operating primary session functionality without interruption
