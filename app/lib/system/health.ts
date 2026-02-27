import os from 'os';
import { getMemoryManager, getStorage } from '@/app/lib/memory';
import { getMemoryOpsSnapshot } from '@/app/lib/memory/ops';
import { getDefaultModel, getEmbeddingModel, getEmbeddingUrl, getLlmBaseUrl } from '@/app/lib/llm/config';
import { getSharedEmbeddings } from '@/app/lib/memory/rag/embeddings';
import { getLlmCircuitSnapshot } from '@/app/lib/llm/resilience';
import { getShutdownSnapshot } from './shutdownRegistry';
import { getSttServiceStatus } from '@/app/lib/voice/server/sttService';
import { getPiperServiceStatus } from '@/app/lib/voice/server/piperService';

type SubsystemStatus = 'ok' | 'degraded' | 'down';

type SubsystemHealth = {
  status: SubsystemStatus;
  details?: Record<string, unknown>;
};

type SystemHealthSnapshot = {
  status: SubsystemStatus;
  timestamp: string;
  uptimeSec: number;
  process: {
    pid: number;
    nodeVersion: string;
    memoryRssMb: number;
    heapUsedMb: number;
    loadAvg1m: number;
    cpuCount: number;
  };
  shutdown: ReturnType<typeof getShutdownSnapshot>;
  subsystems: {
    memory: SubsystemHealth;
    llm: SubsystemHealth;
    embeddings: SubsystemHealth;
    knowledge: SubsystemHealth;
    voice: SubsystemHealth;
  };
};

function statusFromFlags(flags: SubsystemStatus[]): SubsystemStatus {
  if (flags.includes('down')) return 'down';
  if (flags.includes('degraded')) return 'degraded';
  return 'ok';
}

async function checkLlmReachability(): Promise<SubsystemHealth> {
  const url = `${getLlmBaseUrl()}/models`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        status: 'degraded',
        details: {
          baseUrl: getLlmBaseUrl(),
          defaultModel: getDefaultModel(),
          httpStatus: response.status,
          circuits: getLlmCircuitSnapshot(),
        },
      };
    }

    return {
      status: 'ok',
      details: {
        baseUrl: getLlmBaseUrl(),
        defaultModel: getDefaultModel(),
        circuits: getLlmCircuitSnapshot(),
      },
    };
  } catch (error) {
    return {
      status: 'down',
      details: {
        baseUrl: getLlmBaseUrl(),
        defaultModel: getDefaultModel(),
        error: error instanceof Error ? error.message : String(error),
        circuits: getLlmCircuitSnapshot(),
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkEmbeddingsReachability(): Promise<SubsystemHealth> {
  try {
    const available = await getSharedEmbeddings().checkModelAvailability();
    return {
      status: available ? 'ok' : 'degraded',
      details: {
        embeddingUrl: getEmbeddingUrl(),
        embeddingModel: getEmbeddingModel(),
        available,
      },
    };
  } catch (error) {
    return {
      status: 'down',
      details: {
        embeddingUrl: getEmbeddingUrl(),
        embeddingModel: getEmbeddingModel(),
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

async function checkMemory(): Promise<SubsystemHealth> {
  try {
    const memory = getMemoryManager();
    await memory.initialize();
    const queueDepth = memory.getQueueDepths();
    const stats = getStorage().getStats();
    const ops = getMemoryOpsSnapshot(10);
    return {
      status: 'ok',
      details: {
        queueDepth,
        stats,
        recentFailures: ops.recentFailures,
      },
    };
  } catch (error) {
    return {
      status: 'down',
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

async function checkKnowledge(): Promise<SubsystemHealth> {
  try {
    const db = getStorage().getDatabase();
    const documents = (db.prepare('SELECT COUNT(*) as count FROM knowledge_documents').get() as { count: number }).count;
    const chunks = (db.prepare('SELECT COUNT(*) as count FROM knowledge_chunks').get() as { count: number }).count;
    return {
      status: 'ok',
      details: {
        documents,
        chunks,
      },
    };
  } catch (error) {
    return {
      status: 'degraded',
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function checkVoice(): SubsystemHealth {
  try {
    const stt = getSttServiceStatus();
    const piper = getPiperServiceStatus();
    const status: SubsystemStatus = stt.initialized || piper.initialized ? 'ok' : 'degraded';
    return {
      status,
      details: {
        stt,
        piper,
      },
    };
  } catch (error) {
    return {
      status: 'degraded',
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function getSystemHealthSnapshot(): Promise<SystemHealthSnapshot> {
  const processMemory = process.memoryUsage();
  const [memory, llm, embeddings, knowledge] = await Promise.all([
    checkMemory(),
    checkLlmReachability(),
    checkEmbeddingsReachability(),
    checkKnowledge(),
  ]);
  const voice = checkVoice();

  const status = statusFromFlags([
    memory.status,
    llm.status,
    embeddings.status,
    knowledge.status,
    voice.status,
  ]);

  return {
    status,
    timestamp: new Date().toISOString(),
    uptimeSec: process.uptime(),
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      memoryRssMb: Math.round(processMemory.rss / 1024 / 1024),
      heapUsedMb: Math.round(processMemory.heapUsed / 1024 / 1024),
      loadAvg1m: os.loadavg()[0] || 0,
      cpuCount: os.cpus().length,
    },
    shutdown: getShutdownSnapshot(),
    subsystems: {
      memory,
      llm,
      embeddings,
      knowledge,
      voice,
    },
  };
}
