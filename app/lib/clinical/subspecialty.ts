import { createHash } from 'crypto';
import { getStorage } from '@/app/lib/memory';

type ModelRegistryRow = {
  id: string;
  subspecialty: string;
  model_name: string;
  model_version: string;
  endpoint: string | null;
  is_active: number;
  created_at: string;
};

type WeightRow = {
  subspecialty: string;
  biomistral_weight: number;
  meditron_weight: number;
  updated_at: string;
};

function generateId(prefix: string): string {
  const hash = createHash('sha1');
  hash.update(`${prefix}-${Date.now()}-${Math.random()}`);
  return `${prefix}_${hash.digest('hex').slice(0, 16)}`;
}

function normalizeSubspecialty(value: string): string {
  return value.trim().toLowerCase() || 'general';
}

function normalizeWeights(biomistralWeight: number, meditronWeight: number): { biomistral: number; meditron: number } {
  const b = Math.max(0.05, biomistralWeight);
  const m = Math.max(0.05, meditronWeight);
  const total = b + m;
  return {
    biomistral: Math.round((b / total) * 1000) / 1000,
    meditron: Math.round((m / total) * 1000) / 1000,
  };
}

export class SubspecialtyManager {
  private db = getStorage().getDatabase();

  listModelVersions(subspecialty?: string): ModelRegistryRow[] {
    if (subspecialty) {
      return this.db.prepare(`
        SELECT * FROM model_registry
        WHERE subspecialty = ?
        ORDER BY created_at DESC
      `).all(normalizeSubspecialty(subspecialty)) as ModelRegistryRow[];
    }

    return this.db.prepare(`
      SELECT * FROM model_registry
      ORDER BY created_at DESC
    `).all() as ModelRegistryRow[];
  }

  addModelVersion(input: {
    subspecialty: string;
    modelName: string;
    modelVersion: string;
    endpoint?: string | null;
    isActive?: boolean;
  }): ModelRegistryRow {
    const id = generateId('modelreg');
    const subspecialty = normalizeSubspecialty(input.subspecialty);
    const isActive = input.isActive !== false;

    if (isActive) {
      this.db.prepare(`
        UPDATE model_registry
        SET is_active = 0
        WHERE subspecialty = ? AND model_name = ?
      `).run(subspecialty, input.modelName);
    }

    this.db.prepare(`
      INSERT INTO model_registry
      (id, subspecialty, model_name, model_version, endpoint, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      subspecialty,
      input.modelName,
      input.modelVersion,
      input.endpoint || null,
      isActive ? 1 : 0,
      new Date().toISOString()
    );

    return this.db.prepare(`SELECT * FROM model_registry WHERE id = ?`).get(id) as ModelRegistryRow;
  }

  activateModelVersion(id: string): ModelRegistryRow | null {
    const selected = this.db.prepare(`SELECT * FROM model_registry WHERE id = ?`).get(id) as ModelRegistryRow | undefined;
    if (!selected) return null;

    this.db.prepare(`
      UPDATE model_registry
      SET is_active = 0
      WHERE subspecialty = ? AND model_name = ?
    `).run(selected.subspecialty, selected.model_name);

    this.db.prepare(`
      UPDATE model_registry
      SET is_active = 1
      WHERE id = ?
    `).run(id);

    return this.db.prepare(`SELECT * FROM model_registry WHERE id = ?`).get(id) as ModelRegistryRow;
  }

  rollbackModel(subspecialty: string, modelName: string): ModelRegistryRow | null {
    const rows = this.db.prepare(`
      SELECT * FROM model_registry
      WHERE subspecialty = ? AND model_name = ?
      ORDER BY created_at DESC
      LIMIT 2
    `).all(normalizeSubspecialty(subspecialty), modelName) as ModelRegistryRow[];

    if (rows.length < 2) return null;
    return this.activateModelVersion(rows[1].id);
  }

  getWeights(subspecialty: string): WeightRow {
    const normalized = normalizeSubspecialty(subspecialty);
    const row = this.db.prepare(`
      SELECT * FROM subspecialty_ensemble_weights WHERE subspecialty = ?
    `).get(normalized) as WeightRow | undefined;

    if (row) return row;

    const defaults = normalizeWeights(0.7, 0.3);
    this.db.prepare(`
      INSERT INTO subspecialty_ensemble_weights
      (subspecialty, biomistral_weight, meditron_weight, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(normalized, defaults.biomistral, defaults.meditron, new Date().toISOString());

    return this.db.prepare(`
      SELECT * FROM subspecialty_ensemble_weights WHERE subspecialty = ?
    `).get(normalized) as WeightRow;
  }

  setWeights(subspecialty: string, biomistralWeight: number, meditronWeight: number): WeightRow {
    const normalized = normalizeSubspecialty(subspecialty);
    const weights = normalizeWeights(biomistralWeight, meditronWeight);
    this.db.prepare(`
      INSERT INTO subspecialty_ensemble_weights
      (subspecialty, biomistral_weight, meditron_weight, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(subspecialty) DO UPDATE SET
        biomistral_weight = excluded.biomistral_weight,
        meditron_weight = excluded.meditron_weight,
        updated_at = excluded.updated_at
    `).run(normalized, weights.biomistral, weights.meditron, new Date().toISOString());

    return this.getWeights(normalized);
  }

  optimizeWeightsFromFeedback(subspecialty: string): WeightRow {
    const normalized = normalizeSubspecialty(subspecialty);
    const rows = this.db.prepare(`
      SELECT strategy_variant, AVG(COALESCE(response_quality, 0.7)) as avg_quality
      FROM clinical_ab_experiments e
      JOIN patient_cases c ON c.id = e.case_id
      WHERE LOWER(COALESCE(json_extract(c.tags, '$[0]'), 'general')) LIKE ?
      GROUP BY strategy_variant
    `).all(`%${normalized}%`) as Array<{ strategy_variant: string; avg_quality: number | null }>;

    let biomistral = 0.7;
    let meditron = 0.3;
    for (const row of rows) {
      if (row.strategy_variant === 'variant_a') {
        biomistral = row.avg_quality ?? biomistral;
      } else if (row.strategy_variant === 'variant_b') {
        meditron = row.avg_quality ?? meditron;
      }
    }

    return this.setWeights(normalized, biomistral, meditron);
  }

  getBenchmarkSummary(subspecialty: string): {
    subspecialty: string;
    totalCases: number;
    totalExperiments: number;
    avgQuality: number;
    activeModels: ModelRegistryRow[];
    weights: WeightRow;
  } {
    const normalized = normalizeSubspecialty(subspecialty);
    const totalCases = (this.db.prepare(`
      SELECT COUNT(*) as count
      FROM patient_cases
      WHERE LOWER(tags) LIKE ?
    `).get(`%${normalized}%`) as { count: number }).count;

    const experimentStats = this.db.prepare(`
      SELECT COUNT(*) as count, AVG(COALESCE(response_quality, 0.7)) as avg_quality
      FROM clinical_ab_experiments e
      JOIN patient_cases c ON c.id = e.case_id
      WHERE LOWER(c.tags) LIKE ?
    `).get(`%${normalized}%`) as { count: number; avg_quality: number | null };

    const activeModels = this.db.prepare(`
      SELECT * FROM model_registry
      WHERE subspecialty = ? AND is_active = 1
      ORDER BY created_at DESC
    `).all(normalized) as ModelRegistryRow[];

    return {
      subspecialty: normalized,
      totalCases,
      totalExperiments: experimentStats.count || 0,
      avgQuality: experimentStats.avg_quality ?? 0.7,
      activeModels,
      weights: this.getWeights(normalized),
    };
  }
}

let sharedSubspecialtyManager: SubspecialtyManager | null = null;

export function getSubspecialtyManager(): SubspecialtyManager {
  if (!sharedSubspecialtyManager) {
    sharedSubspecialtyManager = new SubspecialtyManager();
  }
  return sharedSubspecialtyManager;
}

