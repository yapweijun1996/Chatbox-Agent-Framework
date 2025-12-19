/**
 * Schema 工具函数
 * 用于从 Zod schema 提取信息
 */
/**
 * 从 Zod schema 提取属性
 */
export function extractSchemaProperties(schema) {
    if (!schema || !schema._def)
        return {};
    try {
        const shape = schema._def.shape?.();
        if (!shape)
            return {};
        const properties = {};
        for (const [key, value] of Object.entries(shape)) {
            const def = value?._def;
            if (def) {
                properties[key] = {
                    type: zodTypeToJsonType(def.typeName),
                    description: def.description || key
                };
            }
        }
        return properties;
    }
    catch {
        return {};
    }
}
/**
 * 提取必填字段
 */
export function extractRequiredFields(schema) {
    if (!schema || !schema._def)
        return [];
    try {
        const shape = schema._def.shape?.();
        if (!shape)
            return [];
        const required = [];
        for (const [key, value] of Object.entries(shape)) {
            const def = value?._def;
            if (def && def.typeName !== 'ZodOptional') {
                required.push(key);
            }
        }
        return required;
    }
    catch {
        return [];
    }
}
/**
 * Zod 类型转 JSON Schema 类型
 */
export function zodTypeToJsonType(zodType) {
    const mapping = {
        'ZodString': 'string',
        'ZodNumber': 'number',
        'ZodBoolean': 'boolean',
        'ZodArray': 'array',
        'ZodObject': 'object',
    };
    return mapping[zodType] || 'string';
}
/**
 * 构建 OpenAI 格式的 tools 列表
 */
export function buildOpenAIToolsList(toolRegistry, excludeTools = ['lm-studio-llm']) {
    return toolRegistry.list()
        .filter(name => !excludeTools.includes(name))
        .map(name => {
        const tool = toolRegistry.get(name);
        return {
            type: 'function',
            function: {
                name: name,
                description: tool.description,
                parameters: {
                    type: 'object',
                    properties: extractSchemaProperties(tool.inputSchema),
                    required: extractRequiredFields(tool.inputSchema),
                }
            }
        };
    });
}
//# sourceMappingURL=schema-utils.js.map