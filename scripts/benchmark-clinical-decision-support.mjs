#!/usr/bin/env node

import {
  closeExecutionContext,
  createExecutionContext,
  parseCliArgs,
  runDecisionSupportBenchmark,
} from './lib/clinical-benchmark-core.mjs';

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const context = createExecutionContext(args);

  try {
    const result = await runDecisionSupportBenchmark({
      db: context.db,
      fixtures: context.fixtures,
      baseUrl: args.baseUrl,
      timeoutMs: args.timeoutMs,
      clinicianReviews: context.clinicianReviews,
      regressionThreshold: args.regressionThreshold,
    });

    console.log('\nSummary');
    console.log(JSON.stringify({
      runId: result.runId,
      gatePassed: result.aggregate.gate.passed,
      averageScore: result.aggregate.averageScore,
      dimensionAverages: result.aggregate.perDimensionAverage,
      dimensionRegressions: result.dimensionRegressions,
      failingCases: result.caseResults.filter(item => !item.passed).map(item => item.caseId),
    }, null, 2));

    if (args.enforceGates && !result.aggregate.gate.passed) {
      process.exit(2);
    }

    if (args.failOnRegression && result.dimensionRegressions.length > 0) {
      process.exit(3);
    }
  } finally {
    closeExecutionContext(context);
  }
}

main().catch(error => {
  console.error('Decision-support benchmark failed:', error);
  process.exit(1);
});
