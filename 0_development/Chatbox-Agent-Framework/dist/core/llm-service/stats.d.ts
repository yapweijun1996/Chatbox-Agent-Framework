/**
 * LLM 统计收集器
 * 收集和聚合 LLM 调用的统计数据
 */
import type { TokenUsage } from '../llm-provider';
import type { LLMCallStats, LLMAggregateStats } from './types';
/**
 * LLM 统计收集器
 */
export declare class LLMStatsCollector {
    private history;
    private maxHistory;
    private enabled;
    constructor(options?: {
        maxHistory?: number;
        enabled?: boolean;
    });
    /**
     * 记录一次调用
     */
    record(stats: LLMCallStats): void;
    /**
     * 获取聚合统计
     */
    getAggregateStats(): LLMAggregateStats;
    /**
     * 获取最近 N 次调用的统计
     */
    getRecentStats(count?: number): LLMCallStats[];
    /**
     * 获取指定时间范围内的统计
     */
    getStatsInTimeRange(startTime: number, endTime: number): LLMCallStats[];
    /**
     * 获取失败的调用
     */
    getFailedCalls(): LLMCallStats[];
    /**
     * 获取成功率
     */
    getSuccessRate(): number;
    /**
     * 获取平均响应时间
     */
    getAverageResponseTime(): number;
    /**
     * 获取 token 使用摘要
     */
    getTokenUsageSummary(): TokenUsage & {
        count: number;
    };
    /**
     * 清空统计历史
     */
    clear(): void;
    /**
     * 导出统计数据
     */
    export(): {
        history: LLMCallStats[];
        aggregate: LLMAggregateStats;
        exportedAt: number;
    };
    /**
     * 启用/禁用统计收集
     */
    setEnabled(enabled: boolean): void;
    /**
     * 检查是否启用
     */
    isEnabled(): boolean;
}
//# sourceMappingURL=stats.d.ts.map