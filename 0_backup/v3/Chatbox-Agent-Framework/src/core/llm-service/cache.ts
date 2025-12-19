/**
 * LLM 响应缓存
 * 简单的内存缓存实现，支持 TTL 和 LRU 淘汰策略
 */

import type { ChatRequest, ChatResponse } from '../llm-provider';
import type { CacheConfig } from './types';

interface CacheEntry {
    response: ChatResponse;
    timestamp: number;
    hits: number;
}

/**
 * LLM 缓存管理器
 */
export class LLMCache {
    private cache: Map<string, CacheEntry> = new Map();
    private config: CacheConfig;
    private accessOrder: string[] = [];

    constructor(config: CacheConfig) {
        this.config = config;
    }

    /**
     * 生成缓存键
     */
    generateKey(request: ChatRequest): string {
        if (this.config.keyGenerator) {
            return this.config.keyGenerator(request);
        }

        // 默认：基于消息内容和温度生成 key
        const keyData = {
            messages: request.messages.map(m => ({
                role: m.role,
                content: m.content,
            })),
            temperature: request.temperature ?? 0.7,
        };

        return this.hashString(JSON.stringify(keyData));
    }

    /**
     * 简单的字符串哈希
     */
    private hashString(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    /**
     * 获取缓存
     */
    get(key: string): ChatResponse | null {
        if (!this.config.enabled) return null;

        const entry = this.cache.get(key);
        if (!entry) return null;

        // 检查 TTL
        if (Date.now() - entry.timestamp > this.config.ttl) {
            this.cache.delete(key);
            this.removeFromAccessOrder(key);
            return null;
        }

        // 更新访问顺序（LRU）
        entry.hits++;
        this.updateAccessOrder(key);

        return entry.response;
    }

    /**
     * 设置缓存
     */
    set(key: string, response: ChatResponse): void {
        if (!this.config.enabled) return;

        // 检查容量，需要时淘汰旧条目
        while (this.cache.size >= this.config.maxEntries) {
            this.evictOldest();
        }

        this.cache.set(key, {
            response,
            timestamp: Date.now(),
            hits: 0,
        });

        this.accessOrder.push(key);
    }

    /**
     * 更新访问顺序
     */
    private updateAccessOrder(key: string): void {
        this.removeFromAccessOrder(key);
        this.accessOrder.push(key);
    }

    /**
     * 从访问顺序中移除
     */
    private removeFromAccessOrder(key: string): void {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
    }

    /**
     * 淘汰最旧的条目（LRU）
     */
    private evictOldest(): void {
        if (this.accessOrder.length === 0) return;

        const oldestKey = this.accessOrder.shift()!;
        this.cache.delete(oldestKey);
    }

    /**
     * 清空缓存
     */
    clear(): void {
        this.cache.clear();
        this.accessOrder = [];
    }

    /**
     * 获取缓存统计
     */
    getStats(): { size: number; maxSize: number; hitRate: number } {
        let totalHits = 0;
        let totalAccess = 0;

        this.cache.forEach(entry => {
            totalHits += entry.hits;
            totalAccess += entry.hits + 1; // +1 for initial set
        });

        return {
            size: this.cache.size,
            maxSize: this.config.maxEntries,
            hitRate: totalAccess > 0 ? totalHits / totalAccess : 0,
        };
    }

    /**
     * 使指定键的缓存失效
     */
    invalidate(key: string): boolean {
        const existed = this.cache.has(key);
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        return existed;
    }

    /**
     * 清理过期条目
     */
    cleanup(): number {
        const now = Date.now();
        let removed = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.config.ttl) {
                this.cache.delete(key);
                this.removeFromAccessOrder(key);
                removed++;
            }
        }

        return removed;
    }
}
