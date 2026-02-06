const baseUrl = (process.env.EMBEDDING_BASE_URL || process.env.LLM_BASE_URL || 'http://localhost:8080/v1').replace(/\/$/, '');
const url = `${baseUrl}/embeddings`;
const model = process.env.EMBEDDING_MODEL || 'nomic-embed-text';

const totalRequests = parseInt(process.env.EMBEDDING_LOAD_REQUESTS || '50', 10);
const concurrency = parseInt(process.env.EMBEDDING_LOAD_CONCURRENCY || '5', 10);
const batchSize = parseInt(process.env.EMBEDDING_LOAD_BATCH_SIZE || '4', 10);
const payloadText = process.env.EMBEDDING_LOAD_TEXT || 'ACL tear with instability, MRI shows pivot shift, evaluate rehab protocol.';

if (!Number.isFinite(totalRequests) || totalRequests <= 0) {
  throw new Error('EMBEDDING_LOAD_REQUESTS must be a positive integer');
}
if (!Number.isFinite(concurrency) || concurrency <= 0) {
  throw new Error('EMBEDDING_LOAD_CONCURRENCY must be a positive integer');
}
if (!Number.isFinite(batchSize) || batchSize <= 0) {
  throw new Error('EMBEDDING_LOAD_BATCH_SIZE must be a positive integer');
}

const latencies = [];
let sent = 0;
let completed = 0;

async function runRequest() {
  const start = performance.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: Array.from({ length: batchSize }, () => payloadText) })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embedding request failed (${response.status}): ${body}`);
  }

  await response.json();
  const duration = performance.now() - start;
  latencies.push(duration);
  completed += 1;
}

async function worker() {
  while (true) {
    const current = sent;
    if (current >= totalRequests) break;
    sent += 1;
    await runRequest();
  }
}

console.log(`Embedding load test → ${url}`);
console.log(`model=${model} requests=${totalRequests} concurrency=${concurrency} batch=${batchSize}`);

const startAll = performance.now();
await Promise.all(Array.from({ length: concurrency }, () => worker()));
const totalMs = performance.now() - startAll;

latencies.sort((a, b) => a - b);
const percentile = (p) => {
  if (latencies.length === 0) return 0;
  const idx = Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length));
  return latencies[idx];
};

const sum = latencies.reduce((acc, v) => acc + v, 0);
const avg = latencies.length ? sum / latencies.length : 0;

console.log('---');
console.log(`completed=${completed} total_time_ms=${Math.round(totalMs)}`);
console.log(`latency_ms min=${Math.round(latencies[0] || 0)} p50=${Math.round(percentile(50))} p95=${Math.round(percentile(95))} max=${Math.round(latencies[latencies.length - 1] || 0)} avg=${Math.round(avg)}`);
