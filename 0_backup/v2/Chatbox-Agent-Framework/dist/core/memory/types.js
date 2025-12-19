/**
 * 记忆系统类型定义
 * 定义短期和长期记忆的结构与接口
 */
/**
 * 默认配置
 */
export const DEFAULT_MEMORY_CONFIG = {
    shortTermMaxSize: 1000,
    shortTermDefaultTTL: 30 * 60 * 1000, // 30 分钟
    autoConsolidate: true,
    consolidateIntervalMs: 60 * 60 * 1000, // 1 小时
    importanceThreshold: 0.3,
};
//# sourceMappingURL=types.js.map