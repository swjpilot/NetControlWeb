-- Uppercase all net_control_call values in sessions
UPDATE sessions SET net_control_call = UPPER(net_control_call) WHERE net_control_call != UPPER(net_control_call);
