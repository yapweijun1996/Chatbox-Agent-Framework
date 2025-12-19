/**
 * 示例工具实现
 * 提供 SQL 查询和文档搜索的模拟工具
 */
import type { Tool } from '../core/types';
/**
 * SQL 查询工具（模拟）
 * 默认 SELECT-only，拒绝 INSERT/UPDATE/DELETE
 */
export declare const sqlQueryTool: Tool;
/**
 * 文档搜索工具（模拟）
 */
export declare const documentSearchTool: Tool;
/**
 * 获取所有示例工具
 */
export declare function getExampleTools(): Tool[];
//# sourceMappingURL=example-tools.d.ts.map