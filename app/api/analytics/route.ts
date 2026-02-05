import { NextRequest, NextResponse } from 'next/server';
import { patternRecognizer } from '@/app/lib/learning/patternRecognition';
import { parameterTuner } from '@/app/lib/learning/parameterTuner';
import { qualityPredictor } from '@/app/lib/learning/qualityPredictor';
import { strategyManager } from '@/app/lib/strategy/manager';
import { modeAnalytics } from '@/app/lib/domain/modeAnalytics';

/**
 * Analytics API Endpoint
 * Provides learning metrics and performance data for visualization
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'all';

    let data: any = {};

    if (type === 'all' || type === 'themes') {
      // Get theme analytics
      const themeAnalytics = await patternRecognizer.getThemeAnalytics();
      data.themes = themeAnalytics;
    }

    if (type === 'all' || type === 'parameters') {
      // Get parameter tuning analytics
      const parameterAnalytics = await parameterTuner.getParameterAnalytics();
      data.parameters = parameterAnalytics;
    }

    if (type === 'all' || type === 'quality') {
      // Get quality prediction analytics
      const qualityAnalytics = await qualityPredictor.getQualityAnalytics();
      data.quality = qualityAnalytics;
    }

    if (type === 'all' || type === 'strategies') {
      // Get strategy performance for each type
      const strategyTypes = ['balanced', 'speed', 'quality', 'cost', 'adaptive', 'workflow'];
      const strategyPerf = await Promise.all(
        strategyTypes.map(async (strategyType: any) => {
          const perf = await strategyManager.getStrategyPerformance(strategyType);
          // Get detailed feedback breakdown
          const analytics = new (await import('@/app/lib/strategy/analytics/tracker')).StrategyAnalytics();
          const feedback = await analytics.getFeedbackBreakdown(strategyType);
          return {
            strategy: strategyType,
            ...perf,
            feedbackBreakdown: feedback
          };
        })
      );
      data.strategies = strategyPerf;
    }

    if (type === 'all' || type === 'modes') {
      // Get mode performance for each interaction mode
      const modesPerf = await modeAnalytics.getAllModesPerformance();
      data.modes = modesPerf.filter(m => m.totalInteractions > 0); // Only show modes with data
    }

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Analytics API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve analytics' },
      { status: 500 }
    );
  }
}
