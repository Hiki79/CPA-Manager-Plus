import type { ProviderKeyConfig } from '@/types';

export type CodexProviderSortDirection = 'asc' | 'desc';

export interface IndexedCodexProviderConfig {
  config: ProviderKeyConfig;
  originalIndex: number;
}

const getPriority = (config: ProviderKeyConfig) => {
  const priority = config.priority;
  return typeof priority === 'number' && Number.isFinite(priority) ? priority : undefined;
};

export const sortCodexConfigsByPriority = (
  configs: ProviderKeyConfig[],
  direction: CodexProviderSortDirection = 'desc'
): IndexedCodexProviderConfig[] => {
  const indexed = configs.map((config, originalIndex) => ({ config, originalIndex }));

  return [...indexed].sort((left, right) => {
    const leftPriority = getPriority(left.config);
    const rightPriority = getPriority(right.config);
    const leftKnown = leftPriority !== undefined;
    const rightKnown = rightPriority !== undefined;

    if (leftKnown || rightKnown) {
      if (!leftKnown) return 1;
      if (!rightKnown) return -1;

      const diff =
        direction === 'desc'
          ? (rightPriority ?? 0) - (leftPriority ?? 0)
          : (leftPriority ?? 0) - (rightPriority ?? 0);
      if (diff !== 0) return diff;
    }

    // Codex entries do not have stable provider names, so ties keep source order.
    return left.originalIndex - right.originalIndex;
  });
};
