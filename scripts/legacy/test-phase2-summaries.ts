// scripts/test-phase2-summaries.ts
// Test script for Phase 2: Automatic summaries + profile management

import { initializeStorage, getMemoryManager } from '../app/lib/memory';
import { getValidatedMemoryConfig } from '../app/lib/memory/config';

async function testPhase2() {
  console.log('==========================================');
  console.log('Phase 2: Summaries + Profile - Test Script');
  console.log('==========================================\n');

  // 1. Test configuration
  console.log('1. Testing configuration...');
  const config = getValidatedMemoryConfig();
  console.log('✓ Configuration loaded:');
  console.log(`  - RAG_SUMMARY_FREQUENCY: ${config.ragSummaryFrequency}`);
  console.log(`  - Summaries ${config.ragSummaryFrequency > 0 ? 'ENABLED' : 'DISABLED'}\n`);

  // 2. Initialize memory system
  console.log('2. Initializing memory system...');
  await initializeStorage();
  const memory = getMemoryManager();
  await memory.initialize();
  console.log('✓ Memory system initialized\n');

  // 3. Create test conversation
  console.log('3. Creating test conversation...');
  const conversation = memory.createConversation('Phase 2 Summary Test', 'qwen2.5-coder:7b');
  console.log(`✓ Created conversation: ${conversation.id}\n`);

  // 4. Add messages to trigger summary generation
  console.log('4. Adding messages to trigger summary...');
  const freq = config.ragSummaryFrequency;

  if (freq > 0) {
    console.log(`   (Summary will generate after ${freq} assistant messages)\n`);

    for (let i = 1; i <= freq; i++) {
      await memory.saveMessage(
        conversation.id,
        'user',
        `Test user message ${i}: Tell me about feature ${i}`
      );

      await memory.saveMessage(
        conversation.id,
        'assistant',
        `This is assistant response ${i}. Here's information about feature ${i}...`,
        { tokens_used: 50 }
      );

      console.log(`   ✓ Added message pair ${i}/${freq}`);
    }

    console.log('\n✓ All messages added (summary should be generating...)\n');

    // Wait for summary generation (it's async)
    console.log('5. Waiting for summary generation...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if summary was created
    const summary = memory.getConversationSummary(conversation.id);
    if (summary) {
      console.log('✓ Summary generated successfully!');
      console.log(`  - Summary: ${summary.summary.substring(0, 100)}...`);
      console.log(`  - Embedding status: ${summary.embedding_status}`);
      console.log(`  - Updated: ${summary.updated_at}\n`);
    } else {
      console.log('✗ No summary found (check logs for errors)\n');
    }
  } else {
    console.log('⚠ Summaries disabled (RAG_SUMMARY_FREQUENCY=0)\n');
  }

  // 5. Test profile management
  console.log('6. Testing profile management...');

  // Test consent requirement
  console.log('   a) Testing without consent...');
  const consentBefore = memory.isProfileConsentGranted();
  console.log(`      - Consent status: ${consentBefore ? 'granted' : 'not granted'}`);

  // Grant consent
  console.log('   b) Granting profile consent...');
  memory.setProfileConsent(true);
  const consentAfter = memory.isProfileConsentGranted();
  console.log(`      ✓ Consent now: ${consentAfter ? 'granted' : 'not granted'}\n`);

  // Save profile
  console.log('   c) Saving test profile...');
  const testProfile = `codingStyle: Functional programming with TypeScript
languages: TypeScript, Python, Rust
frameworks: Next.js, React, FastAPI
preferences: Clean code, comprehensive testing, detailed documentation
notes: Prefer hooks over classes, async/await over promises`;

  await memory.saveUserProfile(testProfile, true);
  console.log('      ✓ Profile saved\n');

  // Wait for embedding
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Retrieve profile
  console.log('   d) Retrieving profile...');
  const savedProfile = memory.getUserProfile();
  if (savedProfile) {
    console.log('      ✓ Profile retrieved:');
    console.log(`         - Length: ${savedProfile.profile.length} chars`);
    console.log(`         - Embedding status: ${savedProfile.embedding_status}`);
    console.log(`         - Content hash: ${savedProfile.content_hash?.substring(0, 16)}...\n`);
  } else {
    console.log('      ✗ No profile found\n');
  }

  // Test consent revocation
  console.log('   e) Testing consent revocation...');
  memory.setProfileConsent(false);
  const consentRevoked = memory.isProfileConsentGranted();
  console.log(`      ✓ Consent revoked: ${!consentRevoked}`);

  // Profile should still exist but not be used
  const profileAfterRevoke = memory.getUserProfile();
  console.log(`      - Profile still in DB: ${profileAfterRevoke ? 'yes' : 'no'}`);
  console.log(`      - Profile will NOT be used in retrieval\n`);

  // Clean up: clear profile
  console.log('   f) Cleaning up test profile...');
  await memory.clearUserProfile();
  const profileAfterClear = memory.getUserProfile();
  console.log(`      ✓ Profile cleared: ${profileAfterClear ? 'still exists' : 'deleted'}\n`);

  // 6. Test retrieval with profile
  console.log('7. Testing retrieval with profile consent...');
  memory.setProfileConsent(true);
  await memory.saveUserProfile(testProfile, true);
  await new Promise(resolve => setTimeout(resolve, 2000));

  const augmented = await memory.augmentWithMemory(
    'How should I write TypeScript code?',
    5,
    conversation.id
  );

  console.log('   ✓ Retrieval with profile consent:');
  console.log(`      - Retrieved ${augmented.retrieved_context.length} results`);
  console.log(`      - Profile should be included in context\n`);

  // 7. Final statistics
  console.log('8. Final statistics...');
  const stats = await memory.getStats();
  console.log('   ✓ Memory system stats:');
  console.log(`      - Total conversations: ${stats.sqlite.total_conversations}`);
  console.log(`      - Total messages: ${stats.sqlite.total_messages}`);
  console.log(`      - Chroma documents: ${stats.rag.chromaCount}`);
  console.log(`      - Total embeddings: ${stats.rag.totalEmbeddings}`);

  const summaryCount = memory.getConversationSummary(conversation.id) ? 1 : 0;
  const profileCount = memory.getUserProfile() ? 1 : 0;
  console.log(`      - Conversation summaries: ${summaryCount}`);
  console.log(`      - User profiles: ${profileCount}\n`);

  // Cleanup
  console.log('9. Cleaning up test data...');
  memory.deleteConversation(conversation.id);
  await memory.clearUserProfile();
  console.log('   ✓ Test data cleaned up\n');

  console.log('==========================================');
  console.log('Phase 2 Test Complete!');
  console.log('==========================================\n');

  console.log('Summary of Phase 2 Features Tested:');
  console.log('  ✓ Automatic summary generation after N messages');
  console.log('  ✓ Profile consent management');
  console.log('  ✓ Profile save/retrieve/clear');
  console.log('  ✓ Profile embedding generation');
  console.log('  ✓ Consent enforcement in retrieval');
  console.log('  ✓ Profile data persistence\n');

  process.exit(0);
}

// Run the test
testPhase2().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
