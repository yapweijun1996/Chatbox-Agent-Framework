import type { LongTermMemoryItem, MemoryQueryOptions } from './types';

export function toPlainText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

export function matchesTextQuery<T>(item: LongTermMemoryItem<T>, queryLower: string): boolean {
    const contentText = toPlainText(item.content).toLowerCase();
    const summaryText = item.summary?.toLowerCase() || '';
    return contentText.includes(queryLower) || summaryText.includes(queryLower);
}

export function filterByQueryOptions<T>(
    items: LongTermMemoryItem<T>[],
    options: MemoryQueryOptions
): LongTermMemoryItem<T>[] {
    let results = items;

    if (options.minImportance !== undefined) {
        results = results.filter(item => item.metadata.importance >= options.minImportance!);
    }

    if (options.tags && options.tags.length > 0) {
        results = results.filter(item =>
            item.metadata.tags?.some(tag => options.tags!.includes(tag))
        );
    }

    return results;
}

export function sortByQueryOptions<T>(
    items: LongTermMemoryItem<T>[],
    options: MemoryQueryOptions
): LongTermMemoryItem<T>[] {
    const sortBy = options.sortBy || 'importance';
    const sortOrder = options.sortOrder || 'desc';

    return [...items].sort((a, b) => {
        let compareValue = 0;
        switch (sortBy) {
            case 'createdAt':
                compareValue = a.metadata.createdAt - b.metadata.createdAt;
                break;
            case 'lastAccessedAt':
                compareValue = a.metadata.lastAccessedAt - b.metadata.lastAccessedAt;
                break;
            case 'importance':
                compareValue = a.metadata.importance - b.metadata.importance;
                break;
            case 'accessCount':
                compareValue = a.metadata.accessCount - b.metadata.accessCount;
                break;
        }
        return sortOrder === 'asc' ? compareValue : -compareValue;
    });
}

export function applyQueryOptions<T>(
    items: LongTermMemoryItem<T>[],
    options: MemoryQueryOptions
): LongTermMemoryItem<T>[] {
    let results = filterByQueryOptions(items, options);
    results = sortByQueryOptions(results, options);

    if (options.limit) {
        results = results.slice(0, options.limit);
    }

    return results;
}
