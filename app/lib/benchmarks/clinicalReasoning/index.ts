import fs from 'fs';
import path from 'path';
import type { ClinicalBenchmarkFixtureSet } from './types';

export * from './types';
export * from './scorer';

export function loadClinicalBenchmarkFixtures(
  fixturePath = path.join(process.cwd(), 'app/lib/benchmarks/clinicalReasoning/cases.v1.json'),
): ClinicalBenchmarkFixtureSet {
  const raw = fs.readFileSync(fixturePath, 'utf8');
  return JSON.parse(raw) as ClinicalBenchmarkFixtureSet;
}
