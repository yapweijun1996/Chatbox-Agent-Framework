/**
 * Memory Node - Automatically saves important information to memory
 * This node runs after task completion to persist learnings
 */

import type { State, NodeResult } from '../core/types';
import type { MemoryManager } from '../core/memory/types';
import { isPreferenceStatement } from '../core/memory/memory-heuristics';
import { BaseNode } from '../core/node';

export interface MemoryNodeConfig {
    /** Memory manager instance */
    memoryManager: MemoryManager;
    /** Whether to save completed tasks to long-term memory */
    saveCompletedTasks?: boolean;
    /** Whether to detect and save user preferences */
    saveUserPreferences?: boolean;
    /** Whether to save tool results */
    saveToolResults?: boolean;
    /** Custom importance scorer for tasks */
    taskImportanceScorer?: (state: State) => number;
}

/**
 * Memory Node - saves important information from the execution
 */
export class MemoryNode extends BaseNode {
    private memory: MemoryManager;
    private config: Required<Omit<MemoryNodeConfig, 'taskImportanceScorer'>> & {
        taskImportanceScorer?: (state: State) => number;
    };

    constructor(config: MemoryNodeConfig) {
        super('memory', 'Memory Saver');
        this.memory = config.memoryManager;
        this.config = {
            memoryManager: config.memoryManager,
            saveCompletedTasks: config.saveCompletedTasks ?? true,
            saveUserPreferences: config.saveUserPreferences ?? true,
            saveToolResults: config.saveToolResults ?? false,
            taskImportanceScorer: config.taskImportanceScorer,
        };
    }

    async execute(state: State): Promise<NodeResult> {
        const events: NodeResult['events'] = [];

        try {
            if (state.policy.memoryEnabled === false) {
                return this.createResult(state, events);
            }

            // Check if task is complete (all steps done)
            const isComplete = state.task.steps.every(s => s.status === 'completed' || s.status === 'failed');
            const hasCompletedSteps = state.task.steps.some(s => s.status === 'completed');

            // 1. Save completed tasks
            if (this.config.saveCompletedTasks && isComplete && hasCompletedSteps) {
                const saved = await this.saveCompletedTask(state);
                if (saved) {
                    events.push({
                        id: `evt-${Date.now()}`,
                        timestamp: Date.now(),
                        type: 'memory_save',
                        nodeId: this.id,
                        status: 'success',
                        summary: 'Saved completed task to memory',
                        metadata: { kind: 'completed-task', tags: ['completed-task', 'execution'] },
                    });
                }
                events.push({
                    id: `evt-${Date.now()}`,
                    timestamp: Date.now(),
                    type: 'node_end',
                    nodeId: this.id,
                    status: 'success',
                    summary: 'Saved completed task to memory',
                });
            }

            // 2. Save user preferences from conversation
            if (this.config.saveUserPreferences) {
                const saved = await this.saveUserPreferences(state);
                if (saved) {
                    events.push({
                        id: `evt-${Date.now()}`,
                        timestamp: Date.now(),
                        type: 'memory_save',
                        nodeId: this.id,
                        status: 'success',
                        summary: 'Saved user preference to memory',
                        metadata: { kind: 'user-preference', tags: ['user-preference', 'conversation'] },
                    });
                    events.push({
                        id: `evt-${Date.now()}`,
                        timestamp: Date.now(),
                        type: 'node_end',
                        nodeId: this.id,
                        status: 'success',
                        summary: 'Saved user preference to memory',
                    });
                }
            }

            // 3. Save important tool results
            if (this.config.saveToolResults) {
                const savedCount = await this.saveToolResults(state);
                if (savedCount > 0) {
                    events.push({
                        id: `evt-${Date.now()}`,
                        timestamp: Date.now(),
                        type: 'memory_save',
                        nodeId: this.id,
                        status: 'success',
                        summary: `Saved ${savedCount} tool results to memory`,
                        metadata: { kind: 'tool-result', count: savedCount, tags: ['tool-result', 'execution'] },
                    });
                }
            }

            // 4. Save important artifacts
            const artifactCount = await this.saveArtifacts(state);
            if (artifactCount > 0) {
                events.push({
                    id: `evt-${Date.now()}`,
                    timestamp: Date.now(),
                    type: 'memory_save',
                    nodeId: this.id,
                    status: 'success',
                    summary: `Saved ${artifactCount} artifacts to memory`,
                    metadata: { kind: 'artifact', count: artifactCount },
                });
            }

            return this.createResult(state, events);
        } catch (error) {
            console.error('[MemoryNode] Failed to save memories:', error);
            // Don't fail the entire execution if memory saving fails
            events.push({
                id: `evt-${Date.now()}`,
                timestamp: Date.now(),
                type: 'error',
                nodeId: this.id,
                status: 'warning',
                summary: `Memory save failed: ${error instanceof Error ? error.message : String(error)}`,
            });
            return this.createResult(state, events);
        }
    }

    /**
     * Save completed task to long-term memory
     */
    private async saveCompletedTask(state: State): Promise<boolean> {
        const importance = this.config.taskImportanceScorer
            ? this.config.taskImportanceScorer(state)
            : this.calculateTaskImportance(state);

        const completedSteps = state.task.steps.filter(s => s.status === 'completed');
        const taskSummary = {
            goal: state.task.goal,
            stepsCompleted: completedSteps.length,
            totalSteps: state.task.steps.length,
            steps: completedSteps.map(s => ({
                description: s.description,
                status: s.status,
            })),
            completedAt: Date.now(),
        };

        await this.memory.remember(taskSummary, {
            tags: ['completed-task', 'execution'],
            importance,
            longTerm: importance >= 0.6,
        });
        return true;
    }

    /**
     * Detect and save user preferences from conversation
     */
    private async saveUserPreferences(state: State): Promise<boolean> {
        const userMessages = state.conversation.messages.filter(m => m.role === 'user');
        const lastUserMessage = userMessages[userMessages.length - 1];

        if (!lastUserMessage) return false;

        const isPreference = isPreferenceStatement(lastUserMessage.content);

        if (isPreference) {
            await this.memory.remember(lastUserMessage.content, {
                tags: ['user-preference', 'conversation'],
                importance: 0.85,
                longTerm: true,
            });
            return true;
        }
        return false;
    }

    /**
     * Save important tool results
     */
    private async saveToolResults(state: State): Promise<number> {
        let savedCount = 0;
        for (const step of state.task.steps) {
            if (step.status === 'completed' && step.result) {
                // Only save non-trivial results
                const resultStr = JSON.stringify(step.result);
                if (resultStr.length > 50) {
                    await this.memory.remember(
                        {
                            description: step.description,
                            result: step.result,
                        },
                        {
                            tags: ['tool-result', 'execution'],
                            importance: 0.5,
                        }
                    );
                    savedCount += 1;
                }
            }
        }
        return savedCount;
    }

    /**
     * Save important artifacts (SQL queries, code, etc.)
     */
    private async saveArtifacts(state: State): Promise<number> {
        let savedCount = 0;
        // Save SQL queries
        if (state.artifacts.sql && state.artifacts.sql.length > 0) {
            await this.memory.remember(
                {
                    type: 'sql',
                    queries: state.artifacts.sql,
                    goal: state.task.goal,
                },
                {
                    tags: ['artifact', 'sql', 'query'],
                    importance: 0.6,
                    longTerm: true,
                }
            );
            savedCount += 1;
        }

        // Save file references
        if (state.artifacts.files && state.artifacts.files.length > 0) {
            await this.memory.remember(
                {
                    type: 'files',
                    files: state.artifacts.files,
                    goal: state.task.goal,
                },
                {
                    tags: ['artifact', 'files', 'reference'],
                    importance: 0.7,
                    longTerm: true,
                }
            );
            savedCount += 1;
        }
        return savedCount;
    }

    /**
     * Calculate task importance based on execution characteristics
     */
    private calculateTaskImportance(state: State): number {
        let importance = 0.5; // Base importance

        // More steps = more complex = more important
        const stepCount = state.task.steps.length;
        importance += Math.min(stepCount * 0.05, 0.2);

        // Failed steps reduce importance
        const failedCount = state.task.steps.filter(s => s.status === 'failed').length;
        if (failedCount > 0) {
            importance -= failedCount * 0.1;
        }

        // Tasks with artifacts are more important
        const hasArtifacts =
            (state.artifacts.sql && state.artifacts.sql.length > 0) ||
            (state.artifacts.files && state.artifacts.files.length > 0);
        if (hasArtifacts) {
            importance += 0.15;
        }

        // Long conversations indicate complexity
        if (state.conversation.messages.length > 10) {
            importance += 0.1;
        }

        return Math.min(Math.max(importance, 0.1), 1.0);
    }
}
