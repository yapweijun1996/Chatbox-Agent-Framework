/**
 * Node 基类
 * 所有节点的基础实现
 */
export class BaseNode {
    id;
    name;
    constructor(id, name) {
        this.id = id;
        this.name = name;
    }
    /**
     * 创建基础 NodeResult
     */
    createResult(state, events = []) {
        return { state, events };
    }
}
//# sourceMappingURL=node.js.map