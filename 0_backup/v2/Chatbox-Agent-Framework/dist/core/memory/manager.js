/**
 * 记忆管理器
 * 统一管理短期和长期记忆，提供高级 API
 */
import { ShortTermMemoryStore } from './short-term';
import { LongTermMemoryStore } from './long-term';
import { DEFAULT_MEMORY_CONFIG } from './types';
/**
 * 记忆管理器实现类
 */
export class MemoryManagerImpl {
    shortTerm;
    longTerm;
    config;
    consolidateTimer;
    constructor(config = {}, persistenceAdapter, embeddingGenerator) {
        this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
        // 初始化短期记忆
        this.shortTerm = new ShortTermMemoryStore({
            maxSize: this.config.shortTermMaxSize,
            defaultTTL: this.config.shortTermDefaultTTL,
        });
        // 初始化长期记忆
        this.longTerm = new LongTermMemoryStore(persistenceAdapter || this.config.persistenceAdapter, embeddingGenerator || this.config.embeddingGenerator);
        // 启动自动整理
        if (this.config.autoConsolidate) {
            this.startAutoConsolidate();
        }
    }
    /**
     * 记住信息（自动选择短期/长期）
     */
    remember(content, options = {}) {
        const importance = options.importance ?? 0.5;
        // 根据参数或重要性决定存储位置
        if (options.longTerm || importance >= 0.7) {
            return this.longTerm.add(content, {
                importance,
                tags: options.tags,
                source: options.source,
            });
        }
        else {
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
    async recall(query) {
        const results = [];
        if (typeof query === 'string') {
            // 文本查询：从长期记忆搜索
            const longTermResults = await this.longTerm.search(query, { limit: 10 });
            results.push(...longTermResults);
            // 从短期记忆中查询（通过标签匹配）
            const shortTermResults = this.shortTerm.query({
                tags: [query],
                limit: 5,
            });
            results.push(...shortTermResults);
        }
        else {
            // 结构化查询
            const longTermResults = await this.longTerm.query(query);
            const shortTermResults = this.shortTerm.query(query);
            results.push(...longTermResults, ...shortTermResults);
        }
        // 按重要性和最近访问时间排序
        results.sort((a, b) => {
            const scoreA = a.metadata.importance + (Date.now() - a.metadata.lastAccessedAt) / (24 * 60 * 60 * 1000);
            const scoreB = b.metadata.importance + (Date.now() - b.metadata.lastAccessedAt) / (24 * 60 * 60 * 1000);
            return scoreB - scoreA;
        });
        return results;
    }
    /**
     * 提升记忆到长期存储
     */
    async promoteToLongTerm(shortTermKey) {
        const content = this.shortTerm.get(shortTermKey);
        if (!content)
            return null;
        // 获取原始记忆项（包含元数据）
        const allItems = this.shortTerm.getAll();
        const item = allItems.get(shortTermKey);
        if (!item)
            return null;
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
    getStats() {
        // 短期记忆统计
        const shortTermItems = this.shortTerm.getAll();
        let shortTermTotalAccesses = 0;
        let shortTermTotalImportance = 0;
        for (const item of shortTermItems.values()) {
            shortTermTotalAccesses += item.metadata.accessCount;
            shortTermTotalImportance += item.metadata.importance;
        }
        const shortTermSize = shortTermItems.size;
        return {
            shortTerm: {
                size: shortTermSize,
                totalAccesses: shortTermTotalAccesses,
                averageImportance: shortTermSize > 0 ? shortTermTotalImportance / shortTermSize : 0,
            },
            longTerm: {
                count: 0, // 需要异步查询，这里简化处理
                averageImportance: 0,
            },
        };
    }
    /**
     * 清理过期记忆
     */
    async cleanup() {
        // 清理短期记忆
        this.shortTerm.cleanup();
        // 长期记忆整理（移除低价值记忆）
        await this.longTerm.consolidate();
    }
    /**
     * 整理记忆
     */
    async consolidate() {
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
    startAutoConsolidate() {
        this.consolidateTimer = setInterval(() => {
            this.consolidate().catch(err => {
                console.error('[MemoryManager] Auto-consolidate failed:', err);
            });
        }, this.config.consolidateIntervalMs);
    }
    /**
     * 停止自动整理
     */
    stopAutoConsolidate() {
        if (this.consolidateTimer) {
            clearInterval(this.consolidateTimer);
            this.consolidateTimer = undefined;
        }
    }
    /**
     * 销毁资源
     */
    destroy() {
        this.stopAutoConsolidate();
        this.shortTerm.clear();
    }
}
/**
 * 创建记忆管理器
 */
export function createMemoryManager(config, persistenceAdapter, embeddingGenerator) {
    return new MemoryManagerImpl(config, persistenceAdapter, embeddingGenerator);
}
//# sourceMappingURL=manager.js.map