/**
 * 记忆管理器
 * 统一管理短期和长期记忆，提供高级 API
 */

import { ShortTermMemoryStore } from './short-term';
import { LongTermMemoryStore } from './long-term';
import type {
    MemoryManager,
    MemoryManagerConfig,
    ShortTermMemory,
    LongTermMemory,
    MemoryStats,
    MemoryQueryOptions,
    MemoryItem,
    MemoryPersistenceAdapter,
    EmbeddingGenerator,
} from './types';
import { DEFAULT_MEMORY_CONFIG } from './types';

/**
 * 记忆管理器实现类
 */
export class MemoryManagerImpl implements MemoryManager {
    public shortTerm: ShortTermMemory;
    public longTerm: LongTermMemory;
    private config: MemoryManagerConfig;
    private consolidateTimer?: NodeJS.Timeout;

    constructor(
        config: Partial<MemoryManagerConfig> = {},
        persistenceAdapter?: MemoryPersistenceAdapter,
        embeddingGenerator?: EmbeddingGenerator
    ) {
        this.config = {
            ...DEFAULT_MEMORY_CONFIG,
            ...config,
            pruningConfig: {
                ...DEFAULT_MEMORY_CONFIG.pruningConfig,
                ...config.pruningConfig,
            },
        };

        // 初始化短期记忆
        this.shortTerm = new ShortTermMemoryStore({
            maxSize: this.config.shortTermMaxSize,
            defaultTTL: this.config.shortTermDefaultTTL,
        });

        // 初始化长期记忆
        this.longTerm = new LongTermMemoryStore(
            persistenceAdapter || this.config.persistenceAdapter,
            embeddingGenerator || this.config.embeddingGenerator,
            this.config.summarizer,
            this.config.pruningConfig
        );

        // 启动自动整理
        if (this.config.autoConsolidate) {
            this.startAutoConsolidate();
        }
    }

    /**
     * 记住信息（自动选择短期/长期）
     */
    async remember<T>(
        content: T,
        options: {
            longTerm?: boolean;
            importance?: number;
            ttl?: number;
            tags?: string[];
            source?: string;
        } = {}
    ): Promise<string> {
        const importance = options.importance ?? 0.5;

        // 根据参数或重要性决定存储位置
        if (options.longTerm || importance >= 0.7) {
            return await this.longTerm.add(content, {
                importance,
                tags: options.tags,
                source: options.source,
            });
        } else {
            const key = `stm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
            this.shortTerm.set(key, content, {
                importance,
                tags: options.tags,
                source: options.source,
                expiresAt: options.ttl ? Date.now() + options.ttl : undefined,
            });
            return key;
        }
    }

    /**
     * 回忆信息（从短期和长期记忆中搜索）
     */
    async recall<T>(query: string | MemoryQueryOptions): Promise<MemoryItem<T>[]> {
        const results: MemoryItem<T>[] = [];

        try {
            if (typeof query === 'string') {
                // 文本查询：从长期记忆搜索
                try {
                    const longTermResults = await this.longTerm.search<T>(query, { limit: 10 });
                    results.push(...longTermResults);
                } catch (err) {
                    console.error('[MemoryManager] Long-term search failed:', err);
                }

                // 从短期记忆中查询（通过标签匹配）
                const shortTermResults = this.shortTerm.query<T>({
                    tags: [query],
                    limit: 5,
                });
                results.push(...shortTermResults);
            } else {
                // 结构化查询
                try {
                    const longTermResults = await this.longTerm.query<T>(query);
                    results.push(...longTermResults);
                } catch (err) {
                    console.error('[MemoryManager] Long-term query failed:', err);
                }

                const shortTermResults = this.shortTerm.query<T>(query);
                results.push(...shortTermResults);
            }

            // 按重要性和最近访问时间排序
            // 分数 = 重要性 - (天数自上次访问) * 0.01，让最近访问的项得分更高
            results.sort((a, b) => {
                const daysAgoA = (Date.now() - a.metadata.lastAccessedAt) / (24 * 60 * 60 * 1000);
                const daysAgoB = (Date.now() - b.metadata.lastAccessedAt) / (24 * 60 * 60 * 1000);
                const scoreA = a.metadata.importance - daysAgoA * 0.01;
                const scoreB = b.metadata.importance - daysAgoB * 0.01;
                return scoreB - scoreA;
            });

            return results;
        } catch (err) {
            console.error('[MemoryManager] Recall failed:', err);
            return results;
        }
    }

    /**
     * 提升记忆到长期存储
     */
    async promoteToLongTerm(shortTermKey: string): Promise<string | null> {
        const content = this.shortTerm.get(shortTermKey);
        if (!content) return null;

        // 获取原始记忆项（包含元数据）
        const allItems = this.shortTerm.getAll();
        const item = allItems.get(shortTermKey);
        if (!item) return null;

        // 添加到长期记忆
        const longTermId = await this.longTerm.add(content, {
            importance: item.metadata.importance,
            tags: item.metadata.tags,
            source: item.metadata.source,
        });

        // 从短期记忆中移除
        this.shortTerm.delete(shortTermKey);

        return longTermId;
    }

    /**
     * 获取统计信息
     */
    async getStats(): Promise<MemoryStats> {
        // 短期记忆统计
        const shortTermItems = this.shortTerm.getAll();
        let shortTermTotalAccesses = 0;
        let shortTermTotalImportance = 0;

        for (const item of shortTermItems.values()) {
            shortTermTotalAccesses += item.metadata.accessCount;
            shortTermTotalImportance += item.metadata.importance;
        }

        const shortTermSize = shortTermItems.size;

        // 长期记忆统计
        const longTermCount = await this.longTerm.count();
        const longTermItems = await this.longTerm.query({ limit: 1000 });
        let longTermTotalImportance = 0;

        for (const item of longTermItems) {
            longTermTotalImportance += item.metadata.importance;
        }

        return {
            shortTerm: {
                size: shortTermSize,
                totalAccesses: shortTermTotalAccesses,
                averageImportance: shortTermSize > 0 ? shortTermTotalImportance / shortTermSize : 0,
            },
            longTerm: {
                count: longTermCount,
                averageImportance: longTermCount > 0 ? longTermTotalImportance / longTermCount : 0,
            },
        };
    }

    /**
     * 清理过期记忆
     */
    async cleanup(): Promise<void> {
        // 清理短期记忆
        this.shortTerm.cleanup();

        // 长期记忆整理（移除低价值记忆）
        await this.longTerm.consolidate();
    }

    /**
     * 整理记忆
     */
    async consolidate(): Promise<void> {
        // 分析短期记忆，将高价值的提升到长期
        const shortTermItems = this.shortTerm.getAll();

        for (const [key, item] of shortTermItems.entries()) {
            // 根据访问次数和重要性决定是否提升
            const promotionScore = item.metadata.importance * Math.log(item.metadata.accessCount + 1);

            if (promotionScore > this.config.importanceThreshold * 3) {
                await this.promoteToLongTerm(key);
            }
        }

        // 清理
        await this.cleanup();
    }

    /**
     * 启动自动整理
     */
    private startAutoConsolidate(): void {
        this.consolidateTimer = setInterval(() => {
            this.consolidate().catch(err => {
                console.error('[MemoryManager] Auto-consolidate failed:', err);
            });
        }, this.config.consolidateIntervalMs);
    }

    /**
     * 停止自动整理
     */
    stopAutoConsolidate(): void {
        if (this.consolidateTimer) {
            clearInterval(this.consolidateTimer);
            this.consolidateTimer = undefined;
        }
    }

    /**
     * 销毁资源
     */
    destroy(): void {
        this.stopAutoConsolidate();
        this.shortTerm.clear();
    }
}

/**
 * 创建记忆管理器
 */
export function createMemoryManager(
    config?: Partial<MemoryManagerConfig>,
    persistenceAdapter?: MemoryPersistenceAdapter,
    embeddingGenerator?: EmbeddingGenerator
): MemoryManager {
    return new MemoryManagerImpl(config, persistenceAdapter, embeddingGenerator);
}
