import { NextRequest, NextResponse } from 'next/server';
import { strategyManager } from '@/app/lib/strategy/manager';
import { patternRecognizer } from '@/app/lib/learning/patternRecognition';
import { parameterTuner } from '@/app/lib/learning/parameterTuner';
import { qualityPredictor } from '@/app/lib/learning/qualityPredictor';
import { modeAnalytics } from '@/app/lib/domain/modeAnalytics';

/**
 * Feedback API Endpoint
 * Captures user feedback for continuous learning and adaptation
 *
 * IMPORTANT: Handles both strategy and mode voting independently:
 * - Strategy votes: decisionId starts with 'dec_' (or 'fallback_') → strategy_analytics.db
 * - Mode votes: decisionId starts with 'mode_' → mode_analytics.db
 *
 * This separation prevents FOREIGN KEY constraint errors when voting in
 * Auto mode without Strategy enabled.
 */

export async function POST(req: NextRequest) {
  try {
    const {
      messageId,
      decisionId,
      feedback,
      content,
      timestamp,
      // Additional learning context
      theme,
      complexity,
      temperature,
      maxTokens,
      toolsEnabled,
      modelUsed,
      responseTime,
      tokensUsed,
      userMessage,
      mode // Track interaction mode (clinical-consult, surgical-planning, complications-risk, imaging-dx, rehab-rtp, evidence-brief, auto)
    } = await req.json();

    if (!feedback) {
      return NextResponse.json(
        { error: 'Missing required field: feedback' },
        { status: 400 }
      );
    }

    // Calculate quality score based on feedback
    const qualityScore = feedback === 'positive' ? 0.95 : feedback === 'negative' ? 0.3 : 0.7;

    // Check if we have a valid strategy decision ID
    const hasValidDecisionId = decisionId &&
                                decisionId !== 'undefined' &&
                                decisionId !== 'null' &&
                                (decisionId.startsWith('dec_') || decisionId.startsWith('fallback_')); // Strategy decisions start with 'dec_'

    // Update the strategy outcome ONLY if we have a valid strategy decision
    // (Strategy was enabled during this interaction)
    if (hasValidDecisionId) {
      try {
        await strategyManager.logOutcome(decisionId, {
          decisionId,
          responseQuality: qualityScore,
          responseTime: responseTime || 0,
          tokensUsed: tokensUsed || 0,
          errorOccurred: false,
          retryCount: 0,
          userFeedback: feedback
        });
        console.log(`[Feedback] Strategy outcome logged for decision ${decisionId}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`[Feedback] Could not log strategy outcome for ${decisionId}:`, errorMessage);
        // Continue - mode tracking should still work
      }
    } else {
      console.log(`[Feedback] No strategy decision (using mode ${mode || 'auto'} without strategy enabled)`);
    }

    // Record pattern recognition feedback for theme learning
    if (theme && userMessage) {
      await patternRecognizer.recordThemeFeedback(
        theme,
        userMessage,
        modelUsed || 'unknown',
        qualityScore,
        feedback,
        complexity
      );
    }

    // Record parameter tuning experiment for dynamic learning
    if (theme && complexity !== undefined && temperature !== undefined) {
      await parameterTuner.recordExperiment(
        decisionId,
        theme,
        complexity,
        temperature,
        maxTokens || 8000,
        toolsEnabled || false,
        qualityScore,
        feedback,
        responseTime,
        tokensUsed
      );
    }

    // Record outcome for quality prediction model
    if (theme && complexity !== undefined && modelUsed && temperature !== undefined) {
      await qualityPredictor.recordOutcome(
        theme,
        complexity,
        modelUsed,
        temperature,
        maxTokens || 8000,
        toolsEnabled || false,
        qualityScore,
        feedback,
        responseTime,
        tokensUsed
      );
    }

    // Record mode interaction feedback (for clinical-consult, surgical-planning, complications-risk, imaging-dx, rehab-rtp, evidence-brief, auto modes)
    if (mode) {
      await modeAnalytics.updateFeedback(decisionId, feedback);
      console.log(`[Feedback] Mode ${mode} feedback: ${feedback} (quality: ${qualityScore})`);
    }

    console.log(`[Feedback] User ${feedback} feedback recorded for decision ${decisionId} (theme: ${theme}, mode: ${mode || 'none'}, quality: ${qualityScore})`);

    return NextResponse.json({
      success: true,
      message: 'Feedback recorded and learning updated',
      decisionId,
      feedback,
      qualityScore,
      learningUpdated: {
        themePattern: !!theme,
        parameterTuning: !!(theme && complexity !== undefined),
        qualityPrediction: !!(theme && complexity !== undefined && modelUsed),
        modeTracking: !!mode
      }
    });

  } catch (error: unknown) {
    console.error('[Feedback API] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to record feedback';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
