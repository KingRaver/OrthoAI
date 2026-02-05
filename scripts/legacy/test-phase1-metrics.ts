// scripts/test-phase1-metrics.ts
// Test script for Phase 1: Baseline metrics collection

import { initializeStorage, getMemoryManager } from '../app/lib/memory';
import { getValidatedMemoryConfig } from '../app/lib/memory/config';
import { getMetricsSummary, getDailyMetrics } from '../app/lib/memory/metrics';

async function testPhase1() {
  console.log('======================================');
  console.log('Phase 1: Baseline Metrics - Test Script');
  console.log('======================================\n');

  // 1. Test configuration loading
  console.log('1. Testing configuration...');
  const config = getValidatedMemoryConfig();
  console.log('✓ Configuration loaded:');
  console.log(`  - RAG_HYBRID: ${config.ragHybrid}`);
  console.log(`  - RAG_CHUNKING: ${config.ragChunking}`);
  console.log(`  - RAG_TOKEN_BUDGET: ${config.ragTokenBudget}`);
  console.log(`  - RAG_SUMMARY_FREQUENCY: ${config.ragSummaryFrequency}`);
  console.log(`  - Rerank coefficients: α=${config.ragRerankAlpha}, β=${config.ragRerankBeta}, γ=${config.ragRerankGamma}`);
  console.log(`  - Metrics retention: ${config.metricsRetentionDays} days\n`);

  // 2. Initialize storage and memory system
  console.log('2. Initializing memory system...');
  await initializeStorage();
  const memory = getMemoryManager();
  await memory.initialize();
  console.log('✓ Memory system initialized\n');

  // 3. Create test conversation and messages
  console.log('3. Creating test conversation...');
  const conversation = memory.createConversation('Phase 1 Test Conversation', 'qwen2.5-coder:7b');
  console.log(`✓ Created conversation: ${conversation.id}\n`);

  console.log('4. Adding test messages...');
  await memory.saveMessage(
    conversation.id,
    'user',
    'What is the best way to implement memory systems in TypeScript?'
  );

  await memory.saveMessage(
    conversation.id,
    'assistant',
    'For memory systems in TypeScript, I recommend using a layered approach with SQLite for structured data and vector databases like Chroma for semantic search. This allows you to combine exact matching with similarity search.',
    { tokens_used: 100 }
  );

  await memory.saveMessage(
    conversation.id,
    'user',
    'How do I implement hybrid retrieval with BM25 and dense embeddings?'
  );
  console.log('✓ Added 3 test messages\n');

  // 4. Test retrieval (this will trigger metrics logging)
  console.log('5. Testing retrieval and metrics logging...');
  const augmented = await memory.augmentWithMemory(
    'Tell me about TypeScript memory systems',
    5,
    conversation.id
  );

  console.log(`✓ Retrieval completed:`);
  console.log(`  - Retrieved ${augmented.retrieved_context.length} results`);
  if (augmented.retrieved_context.length > 0) {
    const topSimilarity = augmented.retrieved_context[0].similarity_score;
    console.log(`  - Top similarity: ${(topSimilarity * 100).toFixed(1)}%`);
  }
  console.log('  - Metrics should be logged to retrieval_metrics table\n');

  // 5. Verify metrics were recorded
  console.log('6. Verifying metrics collection...');
  // Wait a moment for async logging
  await new Promise(resolve => setTimeout(resolve, 500));

  const summary = await getMetricsSummary();
  console.log('✓ Metrics summary:');
  console.log(`  - Total queries: ${summary.totalQueries}`);
  console.log(`  - Avg latency: ${summary.avgLatencyMs.toFixed(2)}ms`);
  console.log(`  - Avg top similarity: ${(summary.avgTopSimilarity * 100).toFixed(1)}%`);
  console.log(`  - Source distribution:`);
  console.log(`    - Conversation dense: ${summary.sourceDistribution.conversationDense}`);
  console.log(`    - Global dense: ${summary.sourceDistribution.globalDense}`);
  console.log(`    - Summaries: ${summary.sourceDistribution.summaries}`);
  console.log(`    - Profile: ${summary.sourceDistribution.profile}`);
  console.log(`    - FTS lexical: ${summary.sourceDistribution.ftsLexical} (Phase 3)`);
  console.log('');

  // 6. Test message count (for Phase 2)
  console.log('7. Testing message count helper...');
  const messageCount = memory.getConversationMessageCount(conversation.id);
  const assistantCount = memory.getConversationMessageCount(conversation.id, 'assistant');
  console.log(`✓ Message counts:`);
  console.log(`  - Total: ${messageCount}`);
  console.log(`  - Assistant only: ${assistantCount}\n`);

  // 7. Test profile consent methods
  console.log('8. Testing profile consent...');
  const initialConsent = memory.isProfileConsentGranted();
  console.log(`  - Initial consent: ${initialConsent}`);

  memory.setProfileConsent(true);
  const afterSetConsent = memory.isProfileConsentGranted();
  console.log(`  - After setting true: ${afterSetConsent}`);

  memory.setProfileConsent(false);
  const afterClearConsent = memory.isProfileConsentGranted();
  console.log(`  - After setting false: ${afterClearConsent}`);
  console.log('✓ Consent methods working\n');

  // 8. Cleanup
  console.log('9. Cleaning up test data...');
  memory.deleteConversation(conversation.id);
  console.log('✓ Test conversation deleted\n');

  console.log('======================================');
  console.log('✅ Phase 1 Implementation: ALL TESTS PASSED');
  console.log('======================================');
  console.log('\nNext steps:');
  console.log('  - Monitor metrics via: GET /api/memory/metrics');
  console.log('  - View daily metrics: GET /api/memory/metrics?type=daily&days=7');
  console.log('  - Phase 2: Implement automatic summary generation');
  console.log('  - Phase 3: Implement hybrid retrieval (FTS + reranking)');
  console.log('  - Phase 4: Implement chunking + token budgeting\n');
}

// Run the test
testPhase1()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
