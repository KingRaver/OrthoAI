// app/lib/memory/INTEGRATION_GUIDE.md
# Memory System Integration Guide

This guide shows how to integrate the memory system into your existing Hacker Reign LLM API.

## Quick Start

### 1. Initialize Memory at App Startup

In your Next.js app, initialize the memory system as early as possible. You can do this in:

**Option A: In `app/api/llm/route.ts` (before handling requests)**

```typescript
import { initializeMemory } from '@/lib/memory';

// Initialize on first request
let initialized = false;

if (!initialized) {
  await initializeMemory();
  initialized = true;
}
```

**Option B: Create a separate initialization file**

```typescript
// app/lib/init.ts
import { initializeMemory } from './memory';

export async function initializeApp() {
  await initializeMemory();
}
```

Then in `app/api/llm/route.ts`:
```typescript
import { initializeApp } from '@/lib/init';

export const runtime = 'nodejs'; // Required for SQLite

// Initialize on module load
if (typeof window === 'undefined') {
  initializeApp().catch(console.error);
}
```

### 2. Update `app/api/llm/route.ts` - Full Example

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getMemoryManager } from '@/lib/memory';
import { getTools, executeTools } from '@/lib/tools';
import OpenAI from 'openai';
import type { ChatCompletionMessage } from 'openai/resources/chat';

const openai = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama'
});

export const runtime = 'nodejs'; // Required for SQLite/Chroma

export async function POST(req: NextRequest) {
  try {
    const {
      model = 'qwen2.5-coder:7b-instruct-q5_K_M',
      messages,
      stream = true,
      enableTools = false,
      conversationId = null,
      useMemory = true, // NEW: Enable memory augmentation
    } = await req.json();

    const memory = getMemoryManager();

    // Create conversation if needed
    let currentConversationId = conversationId;
    if (!currentConversationId) {
      const conversation = memory.createConversation(
        `Chat - ${new Date().toLocaleString()}`,
        model
      );
      currentConversationId = conversation.id;
    }

    // ============================================================
    // MEMORY AUGMENTATION: Retrieve past context (NEW)
    // ============================================================
    let systemPrompt = `You are Hacker Reign - a friendly coding expert. Respond in plain text only.

CRITICAL RULES:
- NO markdown syntax (no *, #, \`, [], etc)
- NO code blocks or backticks
- NO lists with bullets or numbers
- NO formatting symbols
- Just plain conversational text

For code: write it inline like this -> print("hello") or useState(0)
For explanations: use natural sentences with commas and periods

Keep responses 1-3 sentences. Be direct and helpful.`;

    // Augment prompt with memory if enabled and this is a user message
    const lastUserMessage = messages[messages.length - 1];
    if (useMemory && lastUserMessage?.role === 'user') {
      try {
        const augmented = await memory.augmentWithMemory(lastUserMessage.content);

        // Only include context if we found relevant memories
        if (augmented.retrieved_context.length > 0) {
          systemPrompt = augmented.enhanced_system_prompt;

          // Log what was retrieved (for debugging)
          console.log('[Memory] Retrieved context:');
          console.log(memory.formatContextForLogging(augmented));
        }
      } catch (error) {
        console.warn('[Memory] Error augmenting prompt:', error);
        // Continue without memory augmentation
      }
    }

    // ============================================================
    // PREPARE MESSAGES FOR LLM
    // ============================================================
    const enhancedMessages = [
      {
        role: 'system' as const,
        content: systemPrompt,
      },
      ...messages.slice(-10), // Keep last 10 messages for context window
    ];

    // ============================================================
    // SAVE USER MESSAGE TO MEMORY
    // ============================================================
    if (lastUserMessage?.role === 'user') {
      try {
        await memory.saveMessage(
          currentConversationId,
          'user',
          lastUserMessage.content
        );
      } catch (error) {
        console.warn('[Memory] Error saving user message:', error);
      }
    }

    // ============================================================
    // CALL LLM (existing code)
    // ============================================================
    const body: any = {
      model,
      messages: enhancedMessages,
      max_tokens: 5555,
      temperature: 0.3,
      top_p: 0.85,
      stream,
      options: {
        num_thread: 12,
        num_gpu: 99,
        num_ctx: 16384,
        repeat_penalty: 1.2,
        num_batch: 512,
        num_predict: 5555,
      },
    };

    if (enableTools) {
      const tools = getTools();
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const url = 'http://localhost:11434/v1/chat/completions';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama error: ${response.status} - ${error}`);
    }

    // ============================================================
    // HANDLE STREAMING RESPONSE
    // ============================================================
    if (stream) {
      // For streaming, collect the response and save to memory after
      let fullContent = '';

      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
              const reader = response.body?.getReader();
              if (!reader) throw new Error('No response body');

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = new TextDecoder().decode(value);
                const lines = text.split('\n');

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const json = JSON.parse(line.slice(6));
                      const content = json.choices[0]?.delta?.content || '';
                      if (content) {
                        fullContent += content;
                        controller.enqueue(new TextEncoder().encode(line + '\n'));
                      }
                    } catch {
                      // Invalid JSON, skip
                    }
                  }
                }
              }

              // ============================================================
              // SAVE ASSISTANT RESPONSE TO MEMORY (after streaming)
              // ============================================================
              if (fullContent) {
                try {
                  await memory.saveMessage(
                    currentConversationId,
                    'assistant',
                    fullContent,
                    { model_used: model }
                  );
                } catch (error) {
                  console.warn('[Memory] Error saving assistant message:', error);
                }
              }

              controller.close();
            } catch (error) {
              console.error('[Stream] Error:', error);
              controller.error(error);
            }
          },
        }),
        {
          headers: { 'Content-Type': 'text/event-stream' },
        }
      );
    }

    // ============================================================
    // HANDLE NON-STREAMING RESPONSE
    // ============================================================
    let data = await response.json();

    // Tool looping (existing code - keep as is)
    if (enableTools) {
      let allMessages = enhancedMessages;
      let loopCount = 0;
      const maxLoops = 5;

      while (data.choices[0].message.tool_calls?.length) {
        loopCount++;
        if (loopCount > maxLoops) {
          throw new Error('Max tool loop iterations reached');
        }

        const toolCalls = data.choices[0].message.tool_calls;
        allMessages.push(data.choices[0].message);
        allMessages = await executeTools(toolCalls, allMessages);

        const toolResponse = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: allMessages, stream: false }),
        });

        if (!toolResponse.ok) throw new Error('Tool execution failed');
        data = await toolResponse.json();
      }
    }

    const assistantMessage = data.choices[0].message.content;

    // ============================================================
    // SAVE ASSISTANT RESPONSE TO MEMORY (non-streaming)
    // ============================================================
    try {
      await memory.saveMessage(
        currentConversationId,
        'assistant',
        assistantMessage,
        { model_used: model }
      );
    } catch (error) {
      console.warn('[Memory] Error saving assistant message:', error);
    }

    // Return response with conversation ID
    return NextResponse.json({
      ...data.choices[0].message,
      conversationId: currentConversationId,
    });
  } catch (error: any) {
    console.error('[LLM API] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

### 3. Update Chat Component to Use Memory

In `components/Chat.tsx`, update your message sending to pass conversation ID:

```typescript
const handleSendMessage = async () => {
  // ... existing code ...

  const response = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: messages,
      stream: true,
      enableTools,
      conversationId, // NEW: Pass conversation ID
      useMemory: true, // NEW: Enable memory augmentation
    }),
  });

  // After streaming starts, save the conversationId for future messages
  if (response.ok && !conversationId) {
    const firstChunk = await response.json();
    if (firstChunk.conversationId) {
      setConversationId(firstChunk.conversationId);
    }
  }
};
```

## API Reference

### getMemoryManager()
Get the memory manager instance:
```typescript
import { getMemoryManager } from '@/lib/memory';

const memory = getMemoryManager();
```

### Key Methods

#### Conversations
```typescript
// Create a new conversation
const conv = memory.createConversation('My Chat', 'qwen2.5-coder', ['python', 'async']);

// Get conversation by ID
const conv = memory.getConversation(conversationId);

// Get all conversations
const all = memory.getAllConversations(limit=50, offset=0);

// Update conversation
memory.updateConversation(conversationId, { title: 'New Title' });

// Delete conversation
await memory.deleteConversation(conversationId);
```

#### Messages
```typescript
// Save a message
const msg = await memory.saveMessage(
  conversationId,
  'user', // or 'assistant'
  'Hello, how are you?',
  { tokens_used: 45, model_used: 'qwen2.5-coder' }
);

// Get messages
const msg = memory.getMessage(messageId);
const all = memory.getConversationMessages(conversationId);
const recent = memory.getLastMessages(conversationId, 10);
```

#### User Preferences
```typescript
// Set a preference
memory.setPreference('preferred_model', 'qwen2.5-coder');
memory.setPreference('theme', { color: 'dark', fontSize: 14 });

// Get preference
const pref = memory.getPreference('preferred_model');

// Get all preferences
const all = memory.getAllPreferences();

// Set system preferences
memory.setSystemPreferences({
  preferred_model: 'qwen2.5-coder',
  rag_top_k: 5,
  max_context_tokens: 16000
});
```

#### RAG & Memory
```typescript
// Augment a message with retrieved context
const augmented = await memory.augmentWithMemory('Tell me about async patterns');
// Returns: { original_query, retrieved_context, enhanced_system_prompt }

// Retrieve similar messages
const results = await memory.retrieveSimilarMessages('async', topK=5);
// Returns: Array of { message, similarity_score, conversation_summary }

// Check if conversation has relevant memories
const has = await memory.hasRelevantMemories(conversationId, query);
```

#### System
```typescript
// Get health status
const health = await memory.getHealthStatus();
// Returns: { sqlite_connected, chroma_connected, embedding_model_available, ... }

// Get statistics
const stats = await memory.getStats();

// Export conversation
const json = memory.exportConversation(conversationId);

// Graceful shutdown
await memory.shutdown();
```

## Environment Variables

Add to `.env.local`:

```env
# Memory system paths
MEMORY_DB_PATH=./.data/hackerreign.db
CHROMA_DB_PATH=./.data/chroma

# Ollama embedding model
OLLAMA_EMBED_HOST=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text

# RAG settings
RAG_TOP_K=5
RAG_SIMILARITY_THRESHOLD=0.3
```

## PostgreSQL Migration (Future)

The schema is designed to migrate to PostgreSQL with pgvector:

```sql
-- Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Convert SQLite schema to PostgreSQL with pgvector support
ALTER TABLE embedding_metadata ADD COLUMN embedding vector(384);
CREATE INDEX ON embedding_metadata USING ivfflat (embedding vector_cosine_ops);
```

The code is structured to make this migration straightforward—swap SQLiteStorage for a PostgresStorage implementation.

## Performance Tips

1. **Batch operations**: Use `saveMessageBatch()` instead of calling `saveMessage()` in a loop
2. **Tune RAG_TOP_K**: Lower values (3-5) are faster; higher (10+) find more context
3. **Use similarity threshold**: Set `RAG_SIMILARITY_THRESHOLD=0.4` or higher to filter noise
4. **Chunk size**: Consider chunking very long messages before embedding
5. **Cleanup**: Call `memory.cleanup()` periodically to optimize database

## Troubleshooting

### "Module not found: better-sqlite3"
Make sure to run:
```bash
npm install
npm run build  # This will compile native modules
```

### "Connection refused" (Chroma)
Make sure Chroma is initialized:
```typescript
await memory.initialize();
```

### Ollama embedding model not found
Pull the embedding model:
```bash
ollama pull nomic-embed-text
```

### Memory not persisting
Check that:
1. `.data/hackerreign.db` file is created
2. `.data/chroma/` directory is created
3. No permission errors in logs

## Next Steps

1. Install dependencies: `npm install`
2. Update your LLM route following the example above
3. Test with: `curl -X POST http://localhost:3000/api/llm -H "Content-Type: application/json" -d '{"messages": [{"role": "user", "content": "Hello"}]}'`
4. Monitor memory stats: `await memory.getStats()`