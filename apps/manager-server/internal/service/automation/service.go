package automation

import (
	"context"
	"errors"

	"github.com/seakee/cpa-manager-plus/apps/manager-server/internal/config"
	"github.com/seakee/cpa-manager-plus/apps/manager-server/internal/store"
)

const (
	SourceStartup = "startup"
	SourceEnv     = "env"
	SourceDB      = "database"
)

type Capability struct {
	Enabled       bool   `json:"enabled"`
	Configured    bool   `json:"configured"`
	Source        string `json:"source"`
	Locked        bool   `json:"locked"`
	EnvKey        string `json:"envKey"`
	ConfigFileKey string `json:"configFileKey"`
	DependsOn     string `json:"dependsOn,omitempty"`
}

type Status struct {
	Source                    string     `json:"source"`
	UpdatedAtMS               int64      `json:"updatedAtMs,omitempty"`
	QuotaCooldown             Capability `json:"quotaCooldown"`
	AccountActions            Capability `json:"accountActions"`
	AccountActionsAutoDisable Capability `json:"accountActionsAutoDisable"`
}

type UpdateRequest struct {
	QuotaCooldownEnabled      *bool `json:"quotaCooldownEnabled,omitempty"`
	AccountActionsEnabled     *bool `json:"accountActionsEnabled,omitempty"`
	AccountActionsAutoDisable *bool `json:"accountActionsAutoDisable,omitempty"`
}

type Service struct {
	cfg   config.Config
	store *store.Store
}

func New(cfg config.Config, st ...*store.Store) *Service {
	var storeRef *store.Store
	if len(st) > 0 {
		storeRef = st[0]
	}
	return &Service{cfg: cfg, store: storeRef}
}

func (s *Service) Status(ctx ...context.Context) Status {
	requestCtx := context.Background()
	if len(ctx) > 0 && ctx[0] != nil {
		requestCtx = ctx[0]
	}
	settings, _, _ := s.loadSettings(requestCtx)
	return s.statusFromSettings(settings)
}

func (s *Service) Update(ctx context.Context, req UpdateRequest) (Status, error) {
	if s.store == nil {
		return Status{}, errors.New("automation settings store is not configured")
	}
	current, _, err := s.loadSettings(ctx)
	if err != nil {
		return Status{}, err
	}
	if req.QuotaCooldownEnabled != nil {
		if s.cfg.QuotaCooldownEnvSet {
			return Status{}, errors.New("quotaCooldownEnabled is locked by environment variable")
		}
		current.QuotaCooldownEnabled = boolPtr(*req.QuotaCooldownEnabled)
	}
	if req.AccountActionsEnabled != nil {
		if s.cfg.AccountActionsEnvSet {
			return Status{}, errors.New("accountActionsEnabled is locked by environment variable")
		}
		current.AccountActionsEnabled = boolPtr(*req.AccountActionsEnabled)
	}
	if req.AccountActionsAutoDisable != nil {
		if s.cfg.AccountActionsAutoEnvSet {
			return Status{}, errors.New("accountActionsAutoDisable is locked by environment variable")
		}
		current.AccountActionsAutoDisable = boolPtr(*req.AccountActionsAutoDisable)
	}
	if err := s.store.SaveAutomationSettings(ctx, current); err != nil {
		return Status{}, err
	}
	saved, _, err := s.loadSettings(ctx)
	if err != nil {
		return Status{}, err
	}
	return s.statusFromSettings(saved), nil
}

func (s *Service) RuntimeSettings(ctx context.Context) RuntimeSettings {
	settings, _, _ := s.loadSettings(ctx)
	status := s.statusFromSettings(settings)
	return RuntimeSettings{
		QuotaCooldownEnabled:      status.QuotaCooldown.Enabled,
		AccountActionsEnabled:     status.AccountActions.Enabled,
		AccountActionsAutoDisable: status.AccountActionsAutoDisable.Enabled,
	}
}

type RuntimeSettings struct {
	QuotaCooldownEnabled      bool
	AccountActionsEnabled     bool
	AccountActionsAutoDisable bool
}

func (s *Service) loadSettings(ctx context.Context) (store.AutomationSettings, bool, error) {
	if s == nil || s.store == nil {
		return store.AutomationSettings{}, false, nil
	}
	return s.store.LoadAutomationSettings(ctx)
}

func (s *Service) statusFromSettings(settings store.AutomationSettings) Status {
	quotaValue, quotaSource, quotaLocked := s.resolveField(settings.QuotaCooldownEnabled, s.cfg.QuotaCooldownEnabled, s.cfg.QuotaCooldownEnvSet)
	accountActionsValue, accountActionsSource, accountActionsLocked := s.resolveField(settings.AccountActionsEnabled, s.cfg.AccountActionsEnabled, s.cfg.AccountActionsEnvSet)
	autoConfigured, autoSource, autoLocked := s.resolveField(settings.AccountActionsAutoDisable, s.cfg.AccountActionsAutoDisable, s.cfg.AccountActionsAutoEnvSet)
	autoEffective := accountActionsValue && autoConfigured

	return Status{
		Source:      overallSource(quotaSource, accountActionsSource, autoSource),
		UpdatedAtMS: settings.UpdatedAtMS,
		QuotaCooldown: Capability{
			Enabled:       quotaValue,
			Configured:    quotaValue,
			Source:        quotaSource,
			Locked:        quotaLocked,
			EnvKey:        "USAGE_QUOTA_COOLDOWN_ENABLED",
			ConfigFileKey: "quotaCooldownEnabled",
		},
		AccountActions: Capability{
			Enabled:       accountActionsValue,
			Configured:    accountActionsValue,
			Source:        accountActionsSource,
			Locked:        accountActionsLocked,
			EnvKey:        "USAGE_ACCOUNT_ACTIONS_ENABLED",
			ConfigFileKey: "accountActionsEnabled",
		},
		AccountActionsAutoDisable: Capability{
			Enabled:       autoEffective,
			Configured:    autoConfigured,
			Source:        autoSource,
			Locked:        autoLocked,
			EnvKey:        "USAGE_ACCOUNT_ACTIONS_AUTO_DISABLE",
			ConfigFileKey: "accountActionsAutoDisable",
			DependsOn:     "accountActions",
		},
	}
}

func (s *Service) resolveField(dbValue *bool, startupValue bool, envLocked bool) (bool, string, bool) {
	if envLocked {
		return startupValue, SourceEnv, true
	}
	if dbValue != nil {
		return *dbValue, SourceDB, false
	}
	return startupValue, SourceStartup, false
}

func overallSource(sources ...string) string {
	hasDB := false
	hasEnv := false
	for _, source := range sources {
		switch source {
		case SourceDB:
			hasDB = true
		case SourceEnv:
			hasEnv = true
		}
	}
	if hasDB {
		return SourceDB
	}
	if hasEnv {
		return SourceEnv
	}
	return SourceStartup
}

func boolPtr(value bool) *bool {
	return &value
}
