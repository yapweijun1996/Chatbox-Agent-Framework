import type { Checkpoint, PersistenceAdapter, RunnerHooks, State } from '../types';
import { EventStream } from '../event-stream';
export declare class CheckpointManager {
    private readonly persistence;
    private readonly eventStream;
    private readonly hooks?;
    constructor(persistence: PersistenceAdapter | undefined, eventStream: EventStream, hooks?: RunnerHooks | undefined);
    save(state: State): Promise<void>;
    load(checkpointId: string): Promise<Checkpoint>;
}
//# sourceMappingURL=checkpoint-manager.d.ts.map