-- Backfill net_count for all existing sessions
UPDATE sessions s SET net_count = sub.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY UPPER(net_control_call) ORDER BY session_date ASC, id ASC) as row_num
  FROM sessions
) sub
WHERE s.id = sub.id;
