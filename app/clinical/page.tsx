'use client';

import { useState } from 'react';
import Link from 'next/link';

type DecisionSupportBundle = {
  redFlags: Array<{ title: string; severity: string; action: string }>;
  differentials: Array<{ diagnosis: string; likelihood: number; rationale: string }>;
  workup: {
    immediateActions: string[];
    imaging: string[];
    labs: string[];
    consults: string[];
  };
  treatmentTree: Array<{ prompt: string; outcome?: string }>;
  complicationRisk: { level: string; score: number };
  predictedOutcome: { probabilityGoodOutcome: number };
  returnTimeline: { returnToWorkWeeks: number; returnToSportWeeks: number };
};

export default function ClinicalPage() {
  const [complaint, setComplaint] = useState('');
  const [history, setHistory] = useState('');
  const [loading, setLoading] = useState(false);
  const [bundle, setBundle] = useState<DecisionSupportBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [womacInput, setWomacInput] = useState('2,2,3,2,1,2,2,3');
  const [womacResult, setWomacResult] = useState<{ total: number; normalized: number } | null>(null);

  async function runDecisionSupport() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/clinical/decision-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bundle',
          complaint,
          history,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate decision support');
      }
      setBundle(data.bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run decision support');
      setBundle(null);
    } finally {
      setLoading(false);
    }
  }

  async function runWomacCalculator() {
    const values = womacInput
      .split(',')
      .map(value => Number(value.trim()))
      .filter(value => Number.isFinite(value));

    const response = await fetch('/api/clinical/decision-support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'calc_womac',
        values,
      }),
    });
    const data = await response.json();
    if (response.ok && data.womac) {
      setWomacResult(data.womac);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/20 to-white">
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-4">
          <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-teal">
            Back to Chat
          </Link>
          <h1 className="text-lg font-black text-slate-900">Clinical Decision Support</h1>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-8 py-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-700">Diagnostic Workup Assistant</h2>
          <textarea
            value={complaint}
            onChange={e => setComplaint(e.target.value)}
            placeholder="Primary complaint (e.g., acute knee instability after pivot injury)"
            className="mb-3 min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            value={history}
            onChange={e => setHistory(e.target.value)}
            placeholder="Clinical history and key findings"
            className="mb-3 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={runDecisionSupport}
            disabled={loading || complaint.trim().length === 0}
            className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Running...' : 'Generate Support Plan'}
          </button>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          {bundle && (
            <div className="mt-6 space-y-4">
              <section>
                <h3 className="text-xs font-bold uppercase text-slate-600">Red Flags</h3>
                {bundle.redFlags.length === 0 ? (
                  <p className="text-sm text-slate-500">No immediate red flags detected.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {bundle.redFlags.map((flag, idx) => (
                      <li key={`${flag.title}-${idx}`} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm">
                        <span className="font-semibold text-red-700">{flag.title}</span> ({flag.severity}) - {flag.action}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase text-slate-600">Top Differentials</h3>
                <ul className="mt-2 space-y-2">
                  {bundle.differentials.map(item => (
                    <li key={item.diagnosis} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <div className="font-semibold text-slate-800">
                        {item.diagnosis} ({Math.round(item.likelihood * 100)}%)
                      </div>
                      <div className="text-slate-600">{item.rationale}</div>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase text-slate-600">Workup</h3>
                <p className="text-sm text-slate-700">
                  Imaging: {bundle.workup.imaging.join(' | ')}
                </p>
                <p className="text-sm text-slate-700">
                  Labs: {bundle.workup.labs.length > 0 ? bundle.workup.labs.join(' | ') : 'None required by default'}
                </p>
                <p className="text-sm text-slate-700">
                  Consults: {bundle.workup.consults.length > 0 ? bundle.workup.consults.join(' | ') : 'Routine follow-up'}
                </p>
              </section>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Outcome Prediction</h2>
            {bundle ? (
              <div className="space-y-2 text-sm text-slate-700">
                <p>Complication risk: <span className="font-semibold">{bundle.complicationRisk.level}</span> (score {bundle.complicationRisk.score})</p>
                <p>Good outcome probability: <span className="font-semibold">{Math.round(bundle.predictedOutcome.probabilityGoodOutcome * 100)}%</span></p>
                <p>Return to work: <span className="font-semibold">{bundle.returnTimeline.returnToWorkWeeks} weeks</span></p>
                <p>Return to sport: <span className="font-semibold">{bundle.returnTimeline.returnToSportWeeks} weeks</span></p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Run a support plan to populate outcome estimates.</p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">WOMAC Calculator</h2>
            <p className="mb-2 text-xs text-slate-500">Comma-separated values (0-4 per item)</p>
            <input
              value={womacInput}
              onChange={e => setWomacInput(e.target.value)}
              className="mb-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={runWomacCalculator}
              className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-white"
            >
              Calculate WOMAC
            </button>
            {womacResult && (
              <div className="mt-3 text-sm text-slate-700">
                <p>Total score: <span className="font-semibold">{womacResult.total}</span></p>
                <p>Normalized function score: <span className="font-semibold">{womacResult.normalized}%</span></p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

