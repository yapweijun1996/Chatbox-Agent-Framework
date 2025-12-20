import { toPlainText } from './utils';

export interface MemorySummaryOptions {
    maxLength: number;
    existingSummary?: string;
}

export interface MemorySummarizer {
    summarize(content: unknown, options: MemorySummaryOptions): Promise<string>;
}

export interface MemoryPruningConfig {
    enabled: boolean;
    minContentLength: number;
    maxSummaryLength: number;
    minAgeMs?: number;
    /** Memories with importance above this threshold will NOT be pruned */
    minImportanceToPreserve?: number;
    maxItemsPerRun?: number;
}

export const DEFAULT_MEMORY_PRUNING_CONFIG: MemoryPruningConfig = {
    enabled: true,
    minContentLength: 400,
    maxSummaryLength: 120,
    minAgeMs: 24 * 60 * 60 * 1000,
    minImportanceToPreserve: 0.6,
    maxItemsPerRun: 50,
};

export class SimpleMemorySummarizer implements MemorySummarizer {
    async summarize(content: unknown, options: MemorySummaryOptions): Promise<string> {
        const text = toPlainText(content);
        if (text.length <= options.maxLength) return text;
        if (options.maxLength <= 3) return text.slice(0, options.maxLength);
        return `${text.slice(0, options.maxLength - 3)}...`;
    }
}
