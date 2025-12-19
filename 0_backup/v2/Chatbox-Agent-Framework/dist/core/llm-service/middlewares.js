/**
 * 内置中间件
 * 提供常用的请求/响应/错误处理中间件
 */
// ============================================================================
// 请求中间件
// ============================================================================
/**
 * 请求日志中间件 - 记录请求信息
 */
export function createRequestLoggingMiddleware(logger = console.log) {
    return {
        name: 'request-logging',
        process(request, context) {
            logger(`[LLM] Request ${context.requestId}`, {
                provider: context.providerName,
                model: context.model,
                messageCount: request.messages.length,
            });
            return request;
        },
    };
}
/**
 * 响应日志中间件 - 记录响应信息
 */
export function createResponseLoggingMiddleware(logger = console.log) {
    return {
        name: 'response-logging',
        process(response, context) {
            logger(`[LLM] Response ${context.requestId}`, {
                duration: Date.now() - context.startTime,
                contentLength: response.content.length,
                usage: response.usage,
            });
            return response;
        },
    };
}
/**
 * 日志中间件工厂 - 同时创建请求和响应日志中间件
 */
export function createLoggingMiddleware(logger = console.log) {
    return {
        request: createRequestLoggingMiddleware(logger),
        response: createResponseLoggingMiddleware(logger),
    };
}
/**
 * 系统提示注入中间件
 */
export function createSystemPromptMiddleware(systemPrompt, options = {}) {
    const { prepend = true, override = false } = options;
    return {
        name: 'system-prompt',
        process(request, _context) {
            const messages = [...request.messages];
            const existingSystemIndex = messages.findIndex(m => m.role === 'system');
            if (override || existingSystemIndex === -1) {
                const systemMessage = { role: 'system', content: systemPrompt };
                if (existingSystemIndex > -1) {
                    messages[existingSystemIndex] = systemMessage;
                }
                else if (prepend) {
                    messages.unshift(systemMessage);
                }
                else {
                    messages.push(systemMessage);
                }
            }
            return { ...request, messages };
        },
    };
}
/**
 * 消息过滤中间件 - 过滤敏感内容
 */
export function createContentFilterMiddleware(filterPatterns) {
    return {
        name: 'content-filter',
        process(request, _context) {
            const messages = request.messages.map(msg => {
                let content = msg.content;
                for (const { pattern, replacement } of filterPatterns) {
                    content = content.replace(pattern, replacement);
                }
                return { ...msg, content };
            });
            return { ...request, messages };
        },
    };
}
/**
 * 消息截断中间件 - 限制消息长度
 */
export function createTruncationMiddleware(maxMessages, options = {}) {
    const { keepSystemPrompt = true, keepLatestN = 2 } = options;
    return {
        name: 'truncation',
        process(request, _context) {
            if (request.messages.length <= maxMessages) {
                return request;
            }
            let messages = request.messages;
            const systemMessage = keepSystemPrompt
                ? messages.find(m => m.role === 'system')
                : undefined;
            // 移除系统消息后处理
            const nonSystemMessages = messages.filter(m => m.role !== 'system');
            // 保留最新的 N 条消息
            const truncatedMessages = nonSystemMessages.slice(-keepLatestN);
            // 重新组装
            messages = systemMessage
                ? [systemMessage, ...truncatedMessages]
                : truncatedMessages;
            return { ...request, messages };
        },
    };
}
// ============================================================================
// 响应中间件
// ============================================================================
/**
 * 响应验证中间件
 */
export function createValidationMiddleware(validator, onInvalid) {
    return {
        name: 'validation',
        process(response, _context) {
            if (!validator(response.content)) {
                if (onInvalid) {
                    return { ...response, content: onInvalid(response.content) };
                }
                throw new Error('Response validation failed');
            }
            return response;
        },
    };
}
/**
 * 响应转换中间件
 */
export function createTransformMiddleware(transformer) {
    return {
        name: 'transform',
        process(response, _context) {
            return { ...response, content: transformer(response.content) };
        },
    };
}
/**
 * JSON 解析中间件
 */
export function createJsonParseMiddleware(options = {}) {
    const { strict = false, defaultValue = null } = options;
    return {
        name: 'json-parse',
        process(response, _context) {
            try {
                // 尝试提取 JSON 块
                const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                const jsonContent = jsonMatch ? jsonMatch[1] : response.content;
                const parsed = JSON.parse(jsonContent);
                return {
                    ...response,
                    content: JSON.stringify(parsed), // 规范化后的 JSON
                };
            }
            catch (error) {
                if (strict) {
                    throw new Error(`Failed to parse JSON response: ${error}`);
                }
                return {
                    ...response,
                    content: JSON.stringify(defaultValue),
                };
            }
        },
    };
}
// ============================================================================
// 错误中间件
// ============================================================================
/**
 * 降级中间件 - 返回默认响应
 */
export function createFallbackMiddleware(fallbackContent) {
    return {
        name: 'fallback',
        process(error, context) {
            const content = typeof fallbackContent === 'function'
                ? fallbackContent(error, context)
                : fallbackContent;
            return {
                content,
                finishReason: 'stop',
            };
        },
    };
}
/**
 * 错误日志中间件
 */
export function createErrorLoggingMiddleware(logger = console.error) {
    return {
        name: 'error-logging',
        process(error, context) {
            logger(`[LLM] Error in request ${context.requestId}`, error, context);
            return null; // 不处理错误，继续传递
        },
    };
}
/**
 * 错误转换中间件 - 转换错误类型
 */
export function createErrorTransformMiddleware(transformer) {
    return {
        name: 'error-transform',
        process(error, context) {
            throw transformer(error, context);
        },
    };
}
//# sourceMappingURL=middlewares.js.map