#!/usr/bin/env node

import {
  closeExecutionContext,
  createCombinedRun,
  createExecutionContext,
  createMarkdownReport,
  mergeTargetResults,
  parseCliArgs,
  runDecisionSupportBenchmark,
  runLlmBenchmark,
  summarizeOutcome,
  writeMarkdownReport,
} from './lib/clinical-benchmark-core.mjs';

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const context = createExecutionContext(args);

  try {
    const decisionSupport = await runDecisionSupportBenchmark({
      db: context.db,
      fixtures: context.fixtures,
      baseUrl: args.baseUrl,
      timeoutMs: args.timeoutMs,
      clinicianReviews: context.clinicianReviews,
      regressionThreshold: args.regressionThreshold,
    });

    const llm = await runLlmBenchmark({
      db: context.db,
      fixtures: context.fixtures,
      baseUrl: args.baseUrl,
      timeoutMs: args.timeoutMs,
      model: args.model,
      clinicianReviews: context.clinicianReviews,
      regressionThreshold: args.regressionThreshold,
    });

    const merged = mergeTargetResults(decisionSupport, llm);

    const combinedRun = createCombinedRun(context.db, {
      fixtureVersion: context.fixtures.version,
      merged,
      decisionSupportRunId: decisionSupport.runId,
      llmRunId: llm.runId,
      regressionThreshold: args.regressionThreshold,
    });

    const generatedAt = new Date().toISOString();
    const reportText = createMarkdownReport({
      generatedAt,
      decisionSupport,
      llm,
      merged,
      combinedRun,
    });
    const reportPath = writeMarkdownReport(args.reportDir, reportText, generatedAt);

    const summary = summarizeOutcome({
      decisionSupport,
      llm,
      merged,
      combinedRun,
    });

    console.log('\nCombined Summary');
    console.log(JSON.stringify({
      ...summary,
      reportPath,
    }, null, 2));

    const automaticGateFailed =
      !decisionSupport.aggregate.gate.passed ||
      !llm.aggregate.gate.passed ||
      !merged.aggregate.gate.passed;

    const clinicianGateFailed = context.clinicianReviews.length > 0 && (
      (decisionSupport.clinicianSummary.available && !decisionSupport.clinicianSummary.gate.passed) ||
      (llm.clinicianSummary.available && !llm.clinicianSummary.gate.passed) ||
      (merged.clinicianSummary.available && !merged.clinicianSummary.gate.passed)
    );

    if (args.enforceGates && (automaticGateFailed || clinicianGateFailed)) {
      process.exit(2);
    }

    if (args.failOnRegression && combinedRun.dimensionRegressions.length > 0) {
      process.exit(3);
    }
  } finally {
    closeExecutionContext(context);
  }
}

main().catch(error => {
  console.error('Clinical benchmark orchestrator failed:', error);
  process.exit(1);
});
