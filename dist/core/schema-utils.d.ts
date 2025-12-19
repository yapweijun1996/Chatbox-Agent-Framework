/**
 * Schema 工具函数
 * 用于从 Zod schema 提取信息
 */
/**
 * 从 Zod schema 提取属性
 */
export declare function extractSchemaProperties(schema: any): Record<string, any>;
/**
 * 提取必填字段
 */
export declare function extractRequiredFields(schema: any): string[];
/**
 * Zod 类型转 JSON Schema 类型
 */
export declare function zodTypeToJsonType(zodType: string): string;
/**
 * 构建 OpenAI 格式的 tools 列表
 */
export declare function buildOpenAIToolsList(toolRegistry: {
    list: () => string[];
    get: (name: string) => any;
}, excludeTools?: string[]): Array<{
    type: string;
    function: any;
}>;
//# sourceMappingURL=schema-utils.d.ts.map