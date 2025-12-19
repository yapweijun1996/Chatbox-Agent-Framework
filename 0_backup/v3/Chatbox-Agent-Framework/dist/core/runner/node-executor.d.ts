import type { Node, NodeResult, RunnerHooks, State } from '../types';
import { EventStream } from '../event-stream';
interface NodeExecutorDeps {
    eventStream: EventStream;
    hooks?: RunnerHooks;
}
export declare class NodeExecutor {
    private readonly deps;
    constructor(deps: NodeExecutorDeps);
    run(node: Node, state: State): Promise<NodeResult>;
}
export {};
//# sourceMappingURL=node-executor.d.ts.map