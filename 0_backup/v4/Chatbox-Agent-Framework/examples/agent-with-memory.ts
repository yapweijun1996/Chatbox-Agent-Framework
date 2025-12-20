/**
 * Example: Agent with Automatic Memory
 *
 * This example shows how to enable automatic memory saving in an agent.
 * The agent will automatically:
 * - Save completed tasks to long-term memory
 * - Detect and save user preferences
 * - Recall relevant memories before executing new tasks
 */

import {
    createAgent,
    createMemoryManager,
    SimpleTFIDFEmbedding,
    IndexedDBMemoryAdapter,
} from '../src/index';

async function main() {
    // 1. Create a memory manager with persistence
    const memoryAdapter = new IndexedDBMemoryAdapter();
    const embeddingGenerator = new SimpleTFIDFEmbedding(128);

    const memory = createMemoryManager(
        {
            shortTermMaxSize: 1000,
            shortTermDefaultTTL: 30 * 60 * 1000, // 30 minutes
            autoConsolidate: true, // Automatically promote high-value memories
            consolidateIntervalMs: 60 * 60 * 1000, // Every hour
        },
        memoryAdapter,
        embeddingGenerator
    );

    // 2. Create agent with memory enabled
    const agent = createAgent({
        provider: {
            type: 'openai',
            apiKey: process.env.OPENAI_API_KEY || '',
            model: 'gpt-4',
        },
        memory, // Pass the memory manager
        enableMemory: true, // Enable automatic memory saving
        mode: 'agent',
        systemPrompt: 'You are a helpful assistant with memory capabilities.',
    });

    console.log('🧠 Agent with Memory initialized!');
    console.log('');

    // 3. First interaction
    console.log('📝 First conversation:');
    const result1 = await agent.chat('My name is Alice and I prefer dark mode for all applications');
    console.log('Assistant:', result1.content);
    console.log('');

    // The agent automatically saves:
    // - The completed task
    // - Detected user preferences (name, UI preference)

    // 4. Check what was saved
    console.log('💾 Checking saved memories:');
    const stats = await memory.getStats();
    console.log(`- Short-term memories: ${stats.shortTerm.size}`);
    console.log(`- Long-term memories: ${stats.longTerm.count}`);
    console.log('');

    // 5. Second interaction - agent recalls previous context
    console.log('📝 Second conversation (with context):');
    const result2 = await agent.chat('What UI theme should I use?');
    console.log('Assistant:', result2.content);
    // Agent should recall the "dark mode" preference
    console.log('');

    // 6. Query memories manually
    console.log('🔍 Searching memories about "Alice":');
    const memories = await memory.recall('Alice');
    console.log(`Found ${memories.length} relevant memories:`);
    memories.slice(0, 3).forEach((m, i) => {
        console.log(`  ${i + 1}. [${m.metadata.importanceLevel}] ${typeof m.content === 'string' ? m.content.slice(0, 60) : JSON.stringify(m.content).slice(0, 60)}...`);
    });
    console.log('');

    // 7. Add custom memories
    console.log('➕ Adding custom memory:');
    await memory.remember('User is working on a machine learning project using Python and TensorFlow', {
        tags: ['user-project', 'ml', 'python'],
        importance: 0.9,
        longTerm: true,
    });
    console.log('Custom memory saved!');
    console.log('');

    // 8. Third interaction - should recall project context
    console.log('📝 Third conversation (with accumulated context):');
    const result3 = await agent.chat('What programming tools should I learn next?');
    console.log('Assistant:', result3.content);
    // Agent should recall: dark mode preference, ML project, Python/TensorFlow
    console.log('');

    // 9. View memory statistics
    console.log('📊 Final memory statistics:');
    const finalStats = await memory.getStats();
    console.log(`- Short-term memories: ${finalStats.shortTerm.size}`);
    console.log(`- Long-term memories: ${finalStats.longTerm.count}`);
    console.log(`- Average importance (short-term): ${finalStats.shortTerm.averageImportance.toFixed(2)}`);
    console.log(`- Average importance (long-term): ${finalStats.longTerm.averageImportance.toFixed(2)}`);
    console.log('');

    // 10. Clean up low-value memories
    console.log('🧹 Consolidating memories (removing low-value items):');
    await memory.consolidate();
    const consolidatedStats = await memory.getStats();
    console.log(`- Remaining short-term: ${consolidatedStats.shortTerm.size}`);
    console.log(`- Remaining long-term: ${consolidatedStats.longTerm.count}`);
}

// Run the example
main().catch(console.error);
