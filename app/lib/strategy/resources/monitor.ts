// app/lib/strategy/resources/monitor.ts
import os from 'os';

/**
 * System Resource Monitor
 * Detects RAM, CPU, GPU, thermal, battery status
 */

export interface SystemResourceInfo {
  availableRAM: number;
  availableGPU: boolean;
  gpuLayers: number;
  cpuThreads: number;
  cpuUsage: number;
  temperature?: number;
  onBattery: boolean;
  batteryLevel?: number;
}

export async function getSystemResources(): Promise<SystemResourceInfo> {
  const totalRAM = os.totalmem() / 1024 / 1024; // MB
  const freeRAM = os.freemem() / 1024 / 1024;

  // Check for environment variable override
  const disableConstraints = process.env.DISABLE_RAM_CONSTRAINTS === 'true';

  // Use full free RAM plus headroom - let the machine cook!
  // System can handle swap/virtual memory, so report generously
  const availableRAM = Math.min(
    totalRAM,
    disableConstraints ? freeRAM * 2.0 : freeRAM * 1.2 // Allow swap/virtual memory usage
  );

  // CPU info
  const cpus = os.cpus();
  const cpuUsage = Math.round(
    cpus.reduce((sum, cpu) => {
      const total = Object.values(cpu.times!).reduce((a, b) => a + b, 0);
      return sum + (1 - cpu.times!.idle! / total);
    }, 0) / cpus.length * 100
  );

  // GPU detection (M-series Macs have integrated GPU, or check LLM server config)
  const gpuAvailable = !!(process.env.LLM_BASE_URL) || os.platform() === 'darwin';

  return {
    availableRAM,
    availableGPU: gpuAvailable,
    gpuLayers: availableRAM > 12000 ? 35 : 20, // Conservative
    cpuThreads: os.cpus().length,
    cpuUsage,
    temperature: undefined, // Requires additional libs
    onBattery: false, // Requires system libs
    batteryLevel: undefined
  };
}
