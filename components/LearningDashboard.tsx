'use client';
import { useState, useEffect } from 'react';

interface ThemeAnalytics {
  theme: string;
  occurrences: number;
  avgQuality: number;
  topModel: string;
}

interface ParameterAnalytics {
  theme: string;
  avgTemperature: number;
  avgQuality: number;
  sampleSize: number;
}

interface QualityAnalytics {
  model: string;
  avgQuality: number;
  sampleCount: number;
  successRate: number;
}

interface StrategyAnalytics {
  strategy: string;
  totalDecisions: number;
  averageQuality: number;
  userSatisfaction: number;
  successRate: number;
  feedbackBreakdown?: {
    positive: number;
    negative: number;
    neutral: number;
    total: number;
    satisfactionTrend: number[];
  };
}

interface ModeAnalytics {
  mode: string;
  totalInteractions: number;
  averageQuality: number;
  userSatisfaction: number;
  successRate: number;
  feedbackBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
    total: number;
    satisfactionTrend: number[];
  };
}

interface AnalyticsData {
  themes?: ThemeAnalytics[];
  parameters?: ParameterAnalytics[];
  quality?: QualityAnalytics[];
  strategies?: StrategyAnalytics[];
  modes?: ModeAnalytics[];
}

export default function LearningDashboard() {
  const [data, setData] = useState<AnalyticsData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'themes' | 'parameters' | 'quality' | 'strategies' | 'modes'>('themes');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics?type=all');
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError('Failed to load analytics');
      }
    } catch (err) {
      setError('Error fetching analytics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-slate-500 text-sm">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal to-cyan-light p-6">
        <h2 className="text-2xl font-bold text-white">Continuous Learning Dashboard</h2>
        <p className="text-cyan-50 text-sm mt-1">Real-time adaptation metrics and performance insights</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        {[
          { id: 'themes', label: 'Theme Patterns', count: data.themes?.length || 0 },
          { id: 'parameters', label: 'Parameter Tuning', count: data.parameters?.length || 0 },
          { id: 'quality', label: 'Quality Prediction', count: data.quality?.length || 0 },
          { id: 'strategies', label: 'Strategy Performance', count: data.strategies?.length || 0 },
          { id: 'modes', label: 'Mode Performance', count: data.modes?.length || 0 }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'text-teal border-b-2 border-teal bg-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.label}
            <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-200 text-xs">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'themes' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Conversation Theme Recognition</h3>
            {data.themes && data.themes.length > 0 ? (
              <div className="grid gap-3">
                {data.themes.map((theme, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex-1">
                      <div className="font-semibold text-slate-900 capitalize">{theme.theme}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {theme.occurrences} occurrences • Best model: {theme.topModel.split(':')[0]}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-teal">
                        {(theme.avgQuality * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-slate-500">Avg Quality</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-400 py-8">
                No theme data yet. Patterns will appear as the system learns from interactions.
              </div>
            )}
          </div>
        )}

        {activeTab === 'parameters' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Dynamic Parameter Optimization</h3>
            {data.parameters && data.parameters.length > 0 ? (
              <div className="grid gap-3">
                {data.parameters.map((param, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-slate-900 capitalize">{param.theme}</div>
                      <div className="text-xs text-slate-500">{param.sampleSize} samples</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <div className="text-xs text-slate-500">Optimal Temperature</div>
                        <div className="text-lg font-bold text-teal">{param.avgTemperature.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Avg Quality</div>
                        <div className="text-lg font-bold text-cyan-light">
                          {(param.avgQuality * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-400 py-8">
                No parameter data yet. The system learns optimal settings from your feedback.
              </div>
            )}
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Model Quality Predictions</h3>
            {data.quality && data.quality.length > 0 ? (
              <div className="grid gap-3">
                {data.quality.map((qual, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold text-slate-900">{qual.model.split(':')[0]}</div>
                      <div className="text-xs text-slate-500">{qual.sampleCount} predictions</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-500">Avg Quality</div>
                        <div className="text-2xl font-bold text-teal">
                          {(qual.avgQuality * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Success Rate</div>
                        <div className="text-2xl font-bold text-cyan-light">
                          {(qual.successRate * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                    {/* Quality bar */}
                    <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal to-cyan-light"
                        style={{ width: `${qual.avgQuality * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-400 py-8">
                No quality data yet. Predictions improve as you provide feedback.
              </div>
            )}
          </div>
        )}

        {activeTab === 'strategies' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Strategy Performance Comparison</h3>
            {data.strategies && data.strategies.length > 0 ? (
              <div className="grid gap-3">
                {data.strategies
                  .filter(s => s.totalDecisions > 0)
                  .map((strat, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-semibold text-slate-900 capitalize">{strat.strategy}</div>
                        <div className="text-xs text-slate-500">{strat.totalDecisions} decisions</div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <div className="text-xs text-slate-500">Quality</div>
                          <div className="text-lg font-bold text-teal">
                            {(strat.averageQuality * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Success</div>
                          <div className="text-lg font-bold text-cyan-light">
                            {(strat.successRate * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Satisfaction</div>
                          <div className="text-lg font-bold text-yellow">
                            {(strat.userSatisfaction * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>

                      {/* Feedback Breakdown */}
                      {strat.feedbackBreakdown && strat.feedbackBreakdown.total > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-200">
                          <div className="text-xs font-semibold text-slate-700 mb-2">User Feedback</div>
                          <div className="flex gap-2 mb-2">
                            <div className="flex-1 text-center">
                              <div className="text-lg font-bold text-green-600">
                                {strat.feedbackBreakdown.positive}
                              </div>
                              <div className="text-xs text-slate-500">👍 Helpful</div>
                            </div>
                            <div className="flex-1 text-center">
                              <div className="text-lg font-bold text-red-600">
                                {strat.feedbackBreakdown.negative}
                              </div>
                              <div className="text-xs text-slate-500">👎 Not Helpful</div>
                            </div>
                            <div className="flex-1 text-center">
                              <div className="text-lg font-bold text-slate-400">
                                {strat.feedbackBreakdown.neutral}
                              </div>
                              <div className="text-xs text-slate-500">No Feedback</div>
                            </div>
                          </div>

                          {/* Satisfaction Trend Mini Chart */}
                          {strat.feedbackBreakdown.satisfactionTrend.length > 0 && (
                            <div className="mt-3">
                              <div className="text-xs text-slate-500 mb-1">Last 10 Responses</div>
                              <div className="flex gap-1 h-6">
                                {strat.feedbackBreakdown.satisfactionTrend.map((score, idx) => (
                                  <div
                                    key={idx}
                                    className="flex-1 rounded-sm transition-all"
                                    style={{
                                      backgroundColor:
                                        score >= 0.9 ? '#10b981' :  // green
                                        score <= 0.2 ? '#ef4444' :  // red
                                        '#94a3b8',  // slate
                                      opacity: 0.6 + (score * 0.4)
                                    }}
                                    title={`${(score * 100).toFixed(0)}%`}
                                  />
                                ))}
                              </div>
                              <div className="flex justify-between text-xs text-slate-400 mt-1">
                                <span>Older</span>
                                <span>Recent</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center text-slate-400 py-8">
                No strategy data yet. Enable adaptive mode to start tracking performance.
              </div>
            )}
          </div>
        )}

        {activeTab === 'modes' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Interaction Mode Performance</h3>
            <p className="text-sm text-slate-600 mb-4">
              Track how well each mode (Auto, Clinical Consult, Surgical Planning, Complications/Risk, Imaging Dx, Rehab/RTP, Evidence Brief) performs based on your feedback.
            </p>
            {data.modes && data.modes.length > 0 ? (
              <div className="grid gap-3">
                {data.modes.map((mode, i) => {
                  const modeNames: Record<string, string> = {
                    'auto': '🤖 Auto Mode',
                    'clinical-consult': '🩺 Clinical Consult',
                    'surgical-planning': '🧰 Surgical Planning',
                    'complications-risk': '⚠️ Complications & Risk',
                    'imaging-dx': '🧠 Imaging Dx',
                    'rehab-rtp': '🏃 Rehab / RTP',
                    'evidence-brief': '📌 Evidence Brief'
                  };
                  const modeName = modeNames[mode.mode] || mode.mode;

                  return (
                    <div key={i} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-semibold text-slate-900">{modeName}</div>
                        <div className="text-xs text-slate-500">{mode.totalInteractions} interactions</div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <div className="text-xs text-slate-500">Quality</div>
                          <div className="text-lg font-bold text-teal">
                            {(mode.averageQuality * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Success</div>
                          <div className="text-lg font-bold text-cyan-light">
                            {(mode.successRate * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">Satisfaction</div>
                          <div className="text-lg font-bold text-yellow">
                            {(mode.userSatisfaction * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>

                      {/* Feedback Breakdown */}
                      {mode.feedbackBreakdown && mode.feedbackBreakdown.total > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-200">
                          <div className="text-xs font-semibold text-slate-700 mb-2">User Feedback</div>
                          <div className="flex gap-2 mb-2">
                            <div className="flex-1 text-center">
                              <div className="text-lg font-bold text-green-600">
                                {mode.feedbackBreakdown.positive}
                              </div>
                              <div className="text-xs text-slate-500">👍 Helpful</div>
                            </div>
                            <div className="flex-1 text-center">
                              <div className="text-lg font-bold text-red-600">
                                {mode.feedbackBreakdown.negative}
                              </div>
                              <div className="text-xs text-slate-500">👎 Not Helpful</div>
                            </div>
                            <div className="flex-1 text-center">
                              <div className="text-lg font-bold text-slate-400">
                                {mode.feedbackBreakdown.neutral}
                              </div>
                              <div className="text-xs text-slate-500">No Feedback</div>
                            </div>
                          </div>

                          {/* Satisfaction Trend Mini Chart */}
                          {mode.feedbackBreakdown.satisfactionTrend.length > 0 && (
                            <div className="mt-3">
                              <div className="text-xs text-slate-500 mb-1">Last 10 Interactions</div>
                              <div className="flex gap-1 h-6">
                                {mode.feedbackBreakdown.satisfactionTrend.map((score, idx) => (
                                  <div
                                    key={idx}
                                    className="flex-1 rounded-sm transition-all"
                                    style={{
                                      backgroundColor:
                                        score >= 0.9 ? '#10b981' :
                                        score <= 0.2 ? '#ef4444' :
                                        '#94a3b8',
                                      opacity: 0.6 + (score * 0.4)
                                    }}
                                    title={`${(score * 100).toFixed(0)}%`}
                                  />
                                ))}
                              </div>
                              <div className="flex justify-between text-xs text-slate-400 mt-1">
                                <span>Older</span>
                                <span>Recent</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-slate-400 py-8">
                No mode data yet. Start using Auto, Synthesis, Mechanistic, Hypothesis, or Study Design modes to see performance metrics!
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-slate-50 border-t border-slate-200 px-6 py-4">
        <button
          onClick={fetchAnalytics}
          className="text-sm text-teal hover:text-cyan-light font-medium transition-colors"
        >
          🔄 Refresh Data
        </button>
      </div>
    </div>
  );
}
