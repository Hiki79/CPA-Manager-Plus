package model

// AutomationSettings stores UI-managed automation switch overrides.
// Nil fields mean "not configured in DB" and fall back to startup config unless
// the corresponding environment variable explicitly locks the value.
type AutomationSettings struct {
	QuotaCooldownEnabled      *bool `json:"quotaCooldownEnabled,omitempty"`
	AccountActionsEnabled     *bool `json:"accountActionsEnabled,omitempty"`
	AccountActionsAutoDisable *bool `json:"accountActionsAutoDisable,omitempty"`
	UpdatedAtMS               int64 `json:"updatedAtMs,omitempty"`
}
