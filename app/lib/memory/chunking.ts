import { Message, MessageChunk, MessageChunkKind } from './schemas';

export interface ChunkingOptions {
  maxChunkTokens?: number;
}

const DEFAULT_MAX_CHUNK_TOKENS = 320;

function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const wordCount = trimmed.split(/\s+/).length;
  const charCount = trimmed.length;
  return Math.max(wordCount, Math.ceil(charCount / 4));
}

function makeChunkId(messageId: string, chunkIndex: number): string {
  return `${messageId}_chunk_${chunkIndex}`;
}

function splitLongText(text: string, maxChars: number): string[] {
  const parts: string[] = [];
  let remaining = text.trim();

  while (remaining.length > maxChars) {
    let splitAt = remaining.lastIndexOf('\n', maxChars);
    if (splitAt < Math.floor(maxChars * 0.4)) {
      splitAt = remaining.lastIndexOf('. ', maxChars);
    }
    if (splitAt < Math.floor(maxChars * 0.4)) {
      splitAt = remaining.lastIndexOf(' ', maxChars);
    }
    if (splitAt <= 0) {
      splitAt = maxChars;
    }
    const segment = remaining.slice(0, splitAt).trim();
    if (segment) {
      parts.push(segment);
    }
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) {
    parts.push(remaining);
  }

  return parts;
}

function normalizeLanguage(languageRaw: string): string | undefined {
  const normalized = languageRaw.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

function formatCodeChunk(content: string, language?: string): string {
  const lang = language || '';
  return `\`\`\`${lang}\n${content.trim()}\n\`\`\``;
}

function createChunk(
  message: Pick<Message, 'id' | 'conversation_id'>,
  chunkIndex: number,
  chunkKind: MessageChunkKind,
  content: string,
  language?: string
): Omit<MessageChunk, 'created_at'> {
  return {
    id: makeChunkId(message.id, chunkIndex),
    parent_message_id: message.id,
    conversation_id: message.conversation_id,
    chunk_index: chunkIndex,
    chunk_kind: chunkKind,
    content,
    language,
    token_estimate: estimateTokens(content),
  };
}

export function chunkMessage(
  message: Pick<Message, 'id' | 'conversation_id' | 'content'>,
  options?: ChunkingOptions
): Omit<MessageChunk, 'created_at'>[] {
  const maxChunkTokens = Math.max(80, options?.maxChunkTokens ?? DEFAULT_MAX_CHUNK_TOKENS);
  const maxChunkChars = maxChunkTokens * 4;
  const content = message.content.replace(/\r\n/g, '\n');
  const chunks: Omit<MessageChunk, 'created_at'>[] = [];
  let chunkIndex = 0;

  function pushProseSegment(segment: string): void {
    const text = segment.trim();
    if (!text) return;

    const paragraphs = text
      .split(/\n{2,}/)
      .map(part => part.trim())
      .filter(Boolean);

    let buffer = '';
    for (const paragraph of paragraphs) {
      const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
      if (estimateTokens(candidate) <= maxChunkTokens) {
        buffer = candidate;
        continue;
      }

      if (buffer) {
        chunks.push(createChunk(message, chunkIndex, 'prose', buffer));
        chunkIndex += 1;
        buffer = '';
      }

      if (estimateTokens(paragraph) <= maxChunkTokens) {
        buffer = paragraph;
        continue;
      }

      const splitParts = splitLongText(paragraph, maxChunkChars);
      for (const part of splitParts) {
        chunks.push(createChunk(message, chunkIndex, 'prose', part));
        chunkIndex += 1;
      }
    }

    if (buffer) {
      chunks.push(createChunk(message, chunkIndex, 'prose', buffer));
      chunkIndex += 1;
    }
  }

  function pushCodeSegment(code: string, languageRaw: string): void {
    const normalizedLanguage = normalizeLanguage(languageRaw);
    const lines = code.trim().split('\n');
    if (lines.length === 0) return;

    let bufferLines: string[] = [];
    const flush = () => {
      if (bufferLines.length === 0) return;
      const formatted = formatCodeChunk(bufferLines.join('\n'), normalizedLanguage);
      chunks.push(createChunk(message, chunkIndex, 'code', formatted, normalizedLanguage));
      chunkIndex += 1;
      bufferLines = [];
    };

    for (const line of lines) {
      const nextLines = [...bufferLines, line];
      const candidate = formatCodeChunk(nextLines.join('\n'), normalizedLanguage);
      if (estimateTokens(candidate) <= maxChunkTokens || bufferLines.length === 0) {
        bufferLines = nextLines;
      } else {
        flush();
        bufferLines = [line];
      }
    }
    flush();
  }

  const codeBlockRegex = /```([A-Za-z0-9_+-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const [fullMatch, languageRaw, codeContent] = match;
    const proseBefore = content.slice(lastIndex, match.index);
    pushProseSegment(proseBefore);
    pushCodeSegment(codeContent, languageRaw || '');
    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < content.length) {
    pushProseSegment(content.slice(lastIndex));
  }

  if (chunks.length === 0) {
    const fallbackContent = content.trim();
    if (!fallbackContent) return [];
    chunks.push(createChunk(message, 0, 'prose', fallbackContent));
  }

  return chunks;
}
