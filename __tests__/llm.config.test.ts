import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDefaultModel,
  getEmbeddingBaseUrl,
  getEmbeddingModel,
  getEmbeddingUrl,
  getLlmApiKey,
  getLlmBaseUrl,
  getLlmChatUrl,
  getLlmChatUrlForModel,
  getLlmRequestTimeoutMs,
} from '@/app/lib/llm/config';

function clearConfigEnv(): void {
  delete process.env.LLM_BASE_URL;
  delete process.env.LLM_DEFAULT_MODEL;
  delete process.env.LLM_API_KEY;
  delete process.env.MODEL_ENDPOINTS;
  delete process.env.LLM_BASE_URL_BIOMISTRAL_7B_INSTRUCT;
  delete process.env.LLM_BASE_URL_MEDITRON_7B;
  delete process.env.EMBEDDING_BASE_URL;
  delete process.env.EMBEDDING_MODEL;
  delete process.env.LLM_REQUEST_TIMEOUT_MS;
}

describe('llm/config', () => {
  afterEach(() => {
    clearConfigEnv();
    vi.restoreAllMocks();
  });

  it('uses defaults when env is not set', () => {
    expect(getLlmBaseUrl()).toBe('http://localhost:8080/v1');
    expect(getLlmChatUrl()).toBe('http://localhost:8080/v1/chat/completions');
    expect(getDefaultModel()).toBe('biomistral-7b-instruct');
    expect(getLlmApiKey()).toBe('llama.cpp');
    expect(getEmbeddingModel()).toBe('nomic-embed-text');
  });

  it('normalizes base URLs and derives embedding URL correctly', () => {
    process.env.LLM_BASE_URL = 'http://127.0.0.1:9000/v1/';
    process.env.EMBEDDING_BASE_URL = 'http://127.0.0.1:9001/v1/';

    expect(getLlmBaseUrl()).toBe('http://127.0.0.1:9000/v1');
    expect(getLlmChatUrl()).toBe('http://127.0.0.1:9000/v1/chat/completions');
    expect(getEmbeddingBaseUrl()).toBe('http://127.0.0.1:9001/v1');
    expect(getEmbeddingUrl()).toBe('http://127.0.0.1:9001/v1/embeddings');
  });

  it('prioritizes model-specific env endpoint over JSON map and default base URL', () => {
    process.env.LLM_BASE_URL = 'http://default:8080/v1';
    process.env.MODEL_ENDPOINTS = JSON.stringify({
      'biomistral-7b-instruct': 'http://json:8080/v1',
      'meditron-7b': 'http://json:8081/v1',
    });
    process.env.LLM_BASE_URL_BIOMISTRAL_7B_INSTRUCT = 'http://env:8080/v1';

    expect(getLlmChatUrlForModel('biomistral-7b-instruct')).toBe(
      'http://env:8080/v1/chat/completions'
    );
    expect(getLlmChatUrlForModel('meditron-7b')).toBe('http://json:8081/v1/chat/completions');
    expect(getLlmChatUrlForModel('unknown-model')).toBe(
      'http://default:8080/v1/chat/completions'
    );
  });

  it('falls back cleanly when MODEL_ENDPOINTS JSON is invalid', () => {
    process.env.LLM_BASE_URL = 'http://fallback:8080/v1';
    process.env.MODEL_ENDPOINTS = '{broken json';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(getLlmChatUrlForModel('meditron-7b')).toBe('http://fallback:8080/v1/chat/completions');
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('clamps timeout bounds and handles invalid timeout values', () => {
    process.env.LLM_REQUEST_TIMEOUT_MS = 'not-a-number';
    expect(getLlmRequestTimeoutMs()).toBe(900000);

    process.env.LLM_REQUEST_TIMEOUT_MS = '100';
    expect(getLlmRequestTimeoutMs()).toBe(600000);

    process.env.LLM_REQUEST_TIMEOUT_MS = '999999999';
    expect(getLlmRequestTimeoutMs()).toBe(1200000);

    process.env.LLM_REQUEST_TIMEOUT_MS = '700000';
    expect(getLlmRequestTimeoutMs()).toBe(700000);
  });
});
