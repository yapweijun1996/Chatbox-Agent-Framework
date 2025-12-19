/**
 * 核心类型定义
 * 定义框架的所有核心接口与类型
 */
// ============================================================================
// Error 相关类型
// ============================================================================
export var ErrorType;
(function (ErrorType) {
    ErrorType["NETWORK"] = "network";
    ErrorType["TIMEOUT"] = "timeout";
    ErrorType["PERMISSION"] = "permission";
    ErrorType["VALIDATION"] = "validation";
    ErrorType["EXECUTION"] = "execution";
    ErrorType["EMPTY_RESULT"] = "empty_result";
    ErrorType["UNTRUSTED_RESULT"] = "untrusted_result";
    ErrorType["BUDGET_EXCEEDED"] = "budget_exceeded";
    ErrorType["UNKNOWN"] = "unknown";
})(ErrorType || (ErrorType = {}));
//# sourceMappingURL=types.js.map