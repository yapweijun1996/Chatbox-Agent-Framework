/**
 * LLM 统计收集器
 * 收集和聚合 LLM 调用的统计数据
 */
/**
 * LLM 统计收集器
 */
export class LLMStatsCollector {
    history = [];
    maxHistory;
    enabled;
    constructor(options = {}) {
        this.maxHistory = options.maxHistory ?? 1000;
        this.enabled = options.enabled ?? true;
    }
    /**
     * 记录一次调用
     */
    record(stats) {
        if (!this.enabled)
            return;
        this.history.push(stats);
        // 保持历史记录在限制内
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }
    /**
     * 获取聚合统计
     */
    getAggregateStats() {
        const stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            cacheHits: 0,
            totalTokens: 0,
            totalPromptTokens: 0,
            totalCompletionTokens: 0,
            totalDuration: 0,
            averageDuration: 0,
            byProvider: {},
            byModel: {},
        };
        for (const call of this.history) {
            stats.totalRequests++;
            stats.totalDuration += call.duration;
            if (call.success) {
                stats.successfulRequests++;
            }
            else {
                stats.failedRequests++;
            }
            if (call.cached) {
                stats.cacheHits++;
            }
            if (call.usage) {
                stats.totalTokens += call.usage.totalTokens;
                stats.totalPromptTokens += call.usage.promptTokens;
                stats.totalCompletionTokens += call.usage.completionTokens;
            }
            // 按 Provider 聚合
            if (!stats.byProvider[call.providerName]) {
                stats.byProvider[call.providerName] = {
                    requests: 0,
                    successes: 0,
                    failures: 0,
                    totalTokens: 0,
                    totalDuration: 0,
                };
            }
            const providerStats = stats.byProvider[call.providerName];
            providerStats.requests++;
            providerStats.totalDuration += call.duration;
            if (call.success)
                providerStats.successes++;
            else
                providerStats.failures++;
            if (call.usage)
                providerStats.totalTokens += call.usage.totalTokens;
            // 按模型聚合
            if (!stats.byModel[call.model]) {
                stats.byModel[call.model] = {
                    requests: 0,
                    successes: 0,
                    failures: 0,
                    totalTokens: 0,
                    averageTokensPerRequest: 0,
                };
            }
            const modelStats = stats.byModel[call.model];
            modelStats.requests++;
            if (call.success)
                modelStats.successes++;
            else
                modelStats.failures++;
            if (call.usage)
                modelStats.totalTokens += call.usage.totalTokens;
        }
        // 计算平均值
        if (stats.totalRequests > 0) {
            stats.averageDuration = stats.totalDuration / stats.totalRequests;
        }
        // 计算每个模型的平均 tokens
        for (const model in stats.byModel) {
            const modelStats = stats.byModel[model];
            if (modelStats.requests > 0) {
                modelStats.averageTokensPerRequest = modelStats.totalTokens / modelStats.requests;
            }
        }
        return stats;
    }
    /**
     * 获取最近 N 次调用的统计
     */
    getRecentStats(count = 10) {
        return this.history.slice(-count);
    }
    /**
     * 获取指定时间范围内的统计
     */
    getStatsInTimeRange(startTime, endTime) {
        return this.history.filter(call => call.startTime >= startTime && call.endTime <= endTime);
    }
    /**
     * 获取失败的调用
     */
    getFailedCalls() {
        return this.history.filter(call => !call.success);
    }
    /**
     * 获取成功率
     */
    getSuccessRate() {
        if (this.history.length === 0)
            return 1;
        const successful = this.history.filter(call => call.success).length;
        return successful / this.history.length;
    }
    /**
     * 获取平均响应时间
     */
    getAverageResponseTime() {
        if (this.history.length === 0)
            return 0;
        const totalDuration = this.history.reduce((sum, call) => sum + call.duration, 0);
        return totalDuration / this.history.length;
    }
    /**
     * 获取 token 使用摘要
     */
    getTokenUsageSummary() {
        const summary = {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            count: 0,
        };
        for (const call of this.history) {
            if (call.usage) {
                summary.promptTokens += call.usage.promptTokens;
                summary.completionTokens += call.usage.completionTokens;
                summary.totalTokens += call.usage.totalTokens;
                summary.count++;
            }
        }
        return summary;
    }
    /**
     * 清空统计历史
     */
    clear() {
        this.history = [];
    }
    /**
     * 导出统计数据
     */
    export() {
        return {
            history: [...this.history],
            aggregate: this.getAggregateStats(),
            exportedAt: Date.now(),
        };
    }
    /**
     * 启用/禁用统计收集
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    /**
     * 检查是否启用
     */
    isEnabled() {
        return this.enabled;
    }
}
//# sourceMappingURL=stats.js.map