import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { IconChevronDown, IconChevronUp } from '@/components/ui/icons';
import iconCodex from '@/assets/icons/codex.svg';
import type { ProviderKeyConfig } from '@/types';
import { maskApiKey } from '@/utils/format';
import { statusBarDataFromRecentRequests } from '@/utils/recentRequests';
import styles from '@/features/aiProviders/AiProvidersPage.module.scss';
import { ProviderList } from '../ProviderList';
import { ProviderStatusBar } from '../ProviderStatusBar';
import {
  getProviderConfigKey,
  getProviderRecentBuckets,
  getProviderTotalStats,
  hasDisableAllModelsRule,
  type ProviderRecentUsageMap,
} from '../utils';
import {
  sortCodexConfigsByPriority,
  type CodexProviderSortDirection,
  type IndexedCodexProviderConfig,
} from './sort';

interface CodexSectionProps {
  configs: ProviderKeyConfig[];
  usageByProvider: ProviderRecentUsageMap;
  loading: boolean;
  disableControls: boolean;
  isSwitching: boolean;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onToggle: (index: number, enabled: boolean) => void;
}

export function CodexSection({
  configs,
  usageByProvider,
  loading,
  disableControls,
  isSwitching,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
}: CodexSectionProps) {
  const { t } = useTranslation();
  const actionsDisabled = disableControls || loading || isSwitching;
  const toggleDisabled = disableControls || loading || isSwitching;
  const [sortDirection, setSortDirection] = useState<CodexProviderSortDirection>('desc');

  const statusBarCache = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof statusBarDataFromRecentRequests>>();

    configs.forEach((config, index) => {
      if (!config.apiKey) return;
      const configKey = getProviderConfigKey(config, index);
      cache.set(
        configKey,
        statusBarDataFromRecentRequests(
          getProviderRecentBuckets(usageByProvider, 'codex', config.apiKey, config.baseUrl)
        )
      );
    });

    return cache;
  }, [configs, usageByProvider]);

  const sortedConfigs = useMemo(
    () => sortCodexConfigsByPriority(configs, sortDirection),
    [configs, sortDirection]
  );

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const renderHeaderActions = () => (
    <div className={styles.cardHeaderActions}>
      <div className={styles.sortControls}>
        <span className={styles.sortLabel}>{t('ai_providers.sort_by_priority')}</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={toggleSortDirection}
          className={styles.sortDirectionButton}
          disabled={actionsDisabled}
          title={
            sortDirection === 'asc'
              ? t('ai_providers.sort_ascending')
              : t('ai_providers.sort_descending')
          }
          aria-label={
            sortDirection === 'asc'
              ? t('ai_providers.sort_ascending')
              : t('ai_providers.sort_descending')
          }
        >
          <span className={styles.sortDirectionIcon}>
            {sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          </span>
          <span>
            {sortDirection === 'asc'
              ? t('ai_providers.sort_asc_short')
              : t('ai_providers.sort_desc_short')}
          </span>
        </Button>
      </div>
      <Button size="sm" onClick={onAdd} disabled={actionsDisabled}>
        {t('ai_providers.codex_add_button')}
      </Button>
    </div>
  );

  return (
    <>
      <Card
        title={
          <span className={styles.cardTitle}>
            <img src={iconCodex} alt="" className={styles.cardTitleIcon} />
            {t('ai_providers.codex_title')}
          </span>
        }
        extra={renderHeaderActions()}
      >
        <ProviderList<IndexedCodexProviderConfig>
          items={sortedConfigs}
          loading={loading}
          keyField={(item) => getProviderConfigKey(item.config, item.originalIndex)}
          emptyTitle={t('ai_providers.codex_empty_title')}
          emptyDescription={t('ai_providers.codex_empty_desc')}
          onEdit={(item) => onEdit(item.originalIndex)}
          onDelete={(item) => onDelete(item.originalIndex)}
          actionsDisabled={actionsDisabled}
          getRowDisabled={(item) => hasDisableAllModelsRule(item.config.excludedModels)}
          renderExtraActions={(item) => (
            <ToggleSwitch
              label={t('ai_providers.config_toggle_label')}
              checked={!hasDisableAllModelsRule(item.config.excludedModels)}
              disabled={toggleDisabled}
              onChange={(value) => void onToggle(item.originalIndex, value)}
            />
          )}
          renderContent={({ config: item, originalIndex }) => {
            const stats = getProviderTotalStats(
              usageByProvider,
              'codex',
              item.apiKey,
              item.baseUrl
            );
            const headerEntries = Object.entries(item.headers || {});
            const configDisabled = hasDisableAllModelsRule(item.excludedModels);
            const excludedModels = item.excludedModels ?? [];
            const statusData =
              statusBarCache.get(getProviderConfigKey(item, originalIndex)) ||
              statusBarDataFromRecentRequests([]);

            return (
              <Fragment>
                <div className="item-title">{t('ai_providers.codex_item_title')}</div>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}>{t('common.api_key')}:</span>
                  <span className={styles.fieldValue}>{maskApiKey(item.apiKey)}</span>
                </div>
                {item.priority !== undefined && (
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{t('common.priority')}:</span>
                    <span className={styles.fieldValue}>{item.priority}</span>
                  </div>
                )}
                {item.prefix && (
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{t('common.prefix')}:</span>
                    <span className={styles.fieldValue}>{item.prefix}</span>
                  </div>
                )}
                {item.baseUrl && (
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{t('common.base_url')}:</span>
                    <span className={styles.fieldValue}>{item.baseUrl}</span>
                  </div>
                )}
                {item.proxyUrl && (
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>{t('common.proxy_url')}:</span>
                    <span className={styles.fieldValue}>{item.proxyUrl}</span>
                  </div>
                )}
                {item.websockets !== undefined && (
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>
                      {t('ai_providers.codex_websockets_label')}:
                    </span>
                    <span className={styles.fieldValue}>
                      {item.websockets ? t('common.yes') : t('common.no')}
                    </span>
                  </div>
                )}
                {headerEntries.length > 0 && (
                  <div className={styles.headerBadgeList}>
                    {headerEntries.map(([key, value]) => (
                      <span key={key} className={styles.headerBadge}>
                        <strong>{key}:</strong> {value}
                      </span>
                    ))}
                  </div>
                )}
                {configDisabled && (
                  <div className="status-badge warning" style={{ marginTop: 8, marginBottom: 0 }}>
                    {t('ai_providers.config_disabled_badge')}
                  </div>
                )}
                {item.models?.length ? (
                  <div className={styles.modelTagList}>
                    <span className={styles.modelCountLabel}>
                      {t('ai_providers.codex_models_count')}: {item.models.length}
                    </span>
                    {item.models.map((model) => (
                      <span key={model.name} className={styles.modelTag}>
                        <span className={styles.modelName}>{model.name}</span>
                        {model.alias && model.alias !== model.name && (
                          <span className={styles.modelAlias}>{model.alias}</span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : null}
                {excludedModels.length ? (
                  <div className={styles.excludedModelsSection}>
                    <div className={styles.excludedModelsLabel}>
                      {t('ai_providers.excluded_models_count', { count: excludedModels.length })}
                    </div>
                    <div className={styles.modelTagList}>
                      {excludedModels.map((model) => (
                        <span
                          key={model}
                          className={`${styles.modelTag} ${styles.excludedModelTag}`}
                        >
                          <span className={styles.modelName}>{model}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className={styles.cardStats}>
                  <span className={`${styles.statPill} ${styles.statSuccess}`}>
                    {t('stats.success')}: {stats.success}
                  </span>
                  <span className={`${styles.statPill} ${styles.statFailure}`}>
                    {t('stats.failure')}: {stats.failure}
                  </span>
                </div>
                <ProviderStatusBar statusData={statusData} />
              </Fragment>
            );
          }}
        />
      </Card>
    </>
  );
}
