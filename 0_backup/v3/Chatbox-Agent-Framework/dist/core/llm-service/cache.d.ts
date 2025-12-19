/**
 * LLM 响应缓存
 * 简单的内存缓存实现，支持 TTL 和 LRU 淘汰策略
 */
import type { ChatRequest, ChatResponse } from '../llm-provider';
import type { CacheConfig } from './types';
/**
 * LLM 缓存管理器
 */
export declare class LLMCache {
    private cache;
    private config;
    private accessOrder;
    constructor(config: CacheConfig);
    /**
     * 生成缓存键
     */
    generateKey(request: ChatRequest): string;
    /**
     * 简单的字符串哈希
     */
    private hashString;
    /**
     * 获取缓存
     */
    get(key: string): ChatResponse | null;
    /**
     * 设置缓存
     */
    set(key: string, response: ChatResponse): void;
    /**
     * 更新访问顺序
     */
    private updateAccessOrder;
    /**
     * 从访问顺序中移除
     */
    private removeFromAccessOrder;
    /**
     * 淘汰最旧的条目（LRU）
     */
    private evictOldest;
    /**
     * 清空缓存
     */
    clear(): void;
    /**
     * 获取缓存统计
     */
    getStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
    };
    /**
     * 使指定键的缓存失效
     */
    invalidate(key: string): boolean;
    /**
     * 清理过期条目
     */
    cleanup(): number;
}
//# sourceMappingURL=cache.d.ts.map