'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface KnowledgeDocument {
  id: string;
  title: string;
  subspecialty: string | null;
  version: string | null;
  created_at: string;
}

interface KnowledgeSearchResult {
  document: KnowledgeDocument;
  chunk: { content: string };
  similarity: number;
}

interface EvidenceResult {
  id: string;
  source_key: string;
  title: string;
  journal: string | null;
  publication_date: string | null;
  evidence_level: string | null;
  study_type: string | null;
  evidence_score: number;
  url: string | null;
  abstract_text: string | null;
}

interface ReferenceResult {
  id: string;
  category: 'implant' | 'medication_protocol' | 'injection_technique' | 'dme_bracing';
  name: string;
  summary: string;
  indications: string | null;
  contraindications: string | null;
  source: string | null;
}

interface SyncJob {
  id: string;
  job_type: string;
  source_key: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed';
  records_ingested: number;
  error_message: string | null;
  created_at: string;
}

interface KnowledgeSource {
  source_key: string;
  name: string;
  category: 'guideline' | 'evidence' | 'reference';
  enabled: boolean;
  last_synced_at: string | null;
}

const initialForm = {
  title: '',
  content: '',
  source: '',
  version: '',
  subspecialty: '',
  diagnosisTags: ''
};

export default function KnowledgePage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KnowledgeSearchResult[]>([]);
  const [evidenceQuery, setEvidenceQuery] = useState('');
  const [evidenceRemote, setEvidenceRemote] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceResults, setEvidenceResults] = useState<EvidenceResult[]>([]);
  const [referenceQuery, setReferenceQuery] = useState('');
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceResults, setReferenceResults] = useState<ReferenceResult[]>([]);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchDocs = async (signal?: AbortSignal) => {
    const response = await fetch('/api/knowledge', { signal });
    if (!response.ok) {
      throw new Error('Failed to load knowledge documents');
    }
    const data = await response.json();
    return (data.documents || []) as KnowledgeDocument[];
  };

  const loadPhase5State = async () => {
    try {
      const [sourcesResponse, syncResponse] = await Promise.all([
        fetch('/api/knowledge/sources'),
        fetch('/api/knowledge/sync?limit=8')
      ]);

      if (sourcesResponse.ok) {
        const data = await sourcesResponse.json();
        setSources((data.sources || []) as KnowledgeSource[]);
      }

      if (syncResponse.ok) {
        const data = await syncResponse.json();
        setSyncJobs((data.jobs || []) as SyncJob[]);
      }
    } catch (error) {
      console.warn('[Knowledge] Failed to load Phase 5 state:', error);
    }
  };

  const loadDocs = async () => {
    setLoading(true);
    try {
      const docs = await fetchDocs();
      setDocuments(docs);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn('[Knowledge] Failed to load documents:', message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    fetchDocs(controller.signal)
      .then(docs => {
        if (isActive) {
          setDocuments(docs);
        }
      })
      .catch(error => {
        if (isActive && error instanceof Error && error.name !== 'AbortError') {
          console.warn('[Knowledge] Failed to load documents:', error.message);
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    void loadPhase5State();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;

    setSaving(true);
    const diagnosisTags = form.diagnosisTags
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);

    const response = await fetch('/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        content: form.content,
        source: form.source || null,
        version: form.version || null,
        subspecialty: form.subspecialty || null,
        diagnosisTags
      })
    });

    if (response.ok) {
      setForm(initialForm);
      await loadDocs();
    }

    setSaving(false);
  };

  const runSearch = async () => {
    if (!query.trim()) return;
    const response = await fetch('/api/knowledge/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 6 })
    });
    const data = await response.json();
    setResults(data.results || []);
  };

  const runEvidenceSearch = async () => {
    if (!evidenceQuery.trim()) return;
    setEvidenceLoading(true);
    try {
      const response = await fetch('/api/knowledge/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: evidenceQuery,
          includeRemote: evidenceRemote,
          limit: 8,
          minEvidenceLevel: 'level-4'
        })
      });

      const data = await response.json();
      setEvidenceResults((data.results || []) as EvidenceResult[]);
    } finally {
      setEvidenceLoading(false);
    }
  };

  const runReferenceSearch = async () => {
    if (!referenceQuery.trim()) return;
    setReferenceLoading(true);
    try {
      const response = await fetch(
        `/api/knowledge/references?q=${encodeURIComponent(referenceQuery)}&limit=8`
      );
      const data = await response.json();
      setReferenceResults((data.results || []) as ReferenceResult[]);
    } finally {
      setReferenceLoading(false);
    }
  };

  const runSeedPhase5 = async () => {
    setSyncBusy(true);
    setSyncMessage(null);
    try {
      const response = await fetch('/api/knowledge/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seedPhase5' })
      });
      const data = await response.json();
      if (response.ok) {
        setSyncMessage(
          `Seeded guidelines: ${data.guidelineSummary?.ingested || 0}, references updated: ${(data.referenceSummary?.inserted || 0) + (data.referenceSummary?.updated || 0)}`
        );
        await loadDocs();
        await loadPhase5State();
      } else {
        setSyncMessage(data.error || 'Failed to seed Phase 5 data');
      }
    } finally {
      setSyncBusy(false);
    }
  };

  const runProcessNextJob = async () => {
    setSyncBusy(true);
    setSyncMessage(null);
    try {
      const response = await fetch('/api/knowledge/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'processNext' })
      });
      const data = await response.json();
      if (response.ok) {
        setSyncMessage(data.message || 'Processed sync job');
        await loadPhase5State();
      } else {
        setSyncMessage(data.error || 'Failed to process sync job');
      }
    } finally {
      setSyncBusy(false);
    }
  };

  const queueEvidenceSync = async (sourceKey: string) => {
    setSyncBusy(true);
    setSyncMessage(null);
    try {
      const response = await fetch('/api/knowledge/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobType: 'evidence_sync',
          sourceKey,
          payload: {
            query: 'orthopedic guideline randomized trial OR cohort',
            maxResults: 12
          }
        })
      });
      const data = await response.json();
      if (response.ok) {
        setSyncMessage(`Queued job ${data.job?.id || ''} for ${sourceKey}`);
        await loadPhase5State();
      } else {
        setSyncMessage(data.error || 'Failed to enqueue sync job');
      }
    } finally {
      setSyncBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-cyan-50/30 to-slate-50">
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-600 hover:text-teal transition-colors group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Back to Chat</span>
          </Link>
          <div className="text-sm font-semibold text-slate-700">Clinical Knowledge</div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="bg-white/90 border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800">Search Knowledge</h2>
            <div className="mt-4 flex gap-2">
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Search guidelines, protocols, or diagnoses"
              />
              <button
                onClick={runSearch}
                className="rounded-xl bg-teal text-white text-sm font-semibold px-4"
              >
                Search
              </button>
            </div>
            {results.length > 0 && (
              <div className="mt-4 space-y-3">
                {results.map((result, idx) => (
                  <div key={`${result.document.id}-${idx}`} className="border border-slate-200 rounded-xl p-4 bg-white">
                    <div className="text-xs font-semibold text-teal">{result.document.title}</div>
                    <div className="text-xs text-slate-500">Similarity {(result.similarity * 100).toFixed(0)}%</div>
                    <p className="text-sm text-slate-700 mt-2 line-clamp-3">{result.chunk.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white/90 border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800">Evidence Search</h2>
            <div className="mt-4 flex gap-2">
              <input
                value={evidenceQuery}
                onChange={event => setEvidenceQuery(event.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Search RCTs, cohorts, and systematic reviews"
              />
              <button
                onClick={runEvidenceSearch}
                disabled={evidenceLoading}
                className="rounded-xl bg-slate-900 text-white text-sm font-semibold px-4 disabled:opacity-60"
              >
                {evidenceLoading ? 'Searching...' : 'Find Evidence'}
              </button>
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={evidenceRemote}
                onChange={event => setEvidenceRemote(event.target.checked)}
                className="rounded border-slate-300"
              />
              Include remote lookup (PubMed/Cochrane)
            </label>
            {evidenceResults.length > 0 && (
              <div className="mt-4 space-y-3">
                {evidenceResults.map(result => (
                  <div key={result.id} className="border border-slate-200 rounded-xl p-4 bg-white">
                    <div className="text-xs font-semibold text-slate-800">{result.title}</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {result.evidence_level || 'ungraded'} • {result.study_type || 'unspecified'} • score {result.evidence_score.toFixed(2)}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {result.journal || 'Unknown journal'} • {result.publication_date ? new Date(result.publication_date).toLocaleDateString() : 'Date n/a'} • {result.source_key}
                    </div>
                    {result.abstract_text && (
                      <p className="text-sm text-slate-700 mt-2 line-clamp-3">{result.abstract_text}</p>
                    )}
                    {result.url && (
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-xs text-teal hover:underline"
                      >
                        Open source →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white/90 border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800">Drug, Device, and Protocol References</h2>
            <div className="mt-4 flex gap-2">
              <input
                value={referenceQuery}
                onChange={event => setReferenceQuery(event.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Search implant, medication, injection, or DME guidance"
              />
              <button
                onClick={runReferenceSearch}
                disabled={referenceLoading}
                className="rounded-xl bg-cyan-700 text-white text-sm font-semibold px-4 disabled:opacity-60"
              >
                {referenceLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
            {referenceResults.length > 0 && (
              <div className="mt-4 space-y-3">
                {referenceResults.map(result => (
                  <div key={result.id} className="border border-slate-200 rounded-xl p-4 bg-white">
                    <div className="text-xs font-semibold text-slate-800">{result.name}</div>
                    <div className="text-[11px] text-slate-500">{result.category.replace('_', ' ')}</div>
                    <p className="text-sm text-slate-700 mt-2">{result.summary}</p>
                    {result.indications && (
                      <p className="text-xs text-slate-600 mt-2"><span className="font-semibold">Indications:</span> {result.indications}</p>
                    )}
                    {result.contraindications && (
                      <p className="text-xs text-slate-600 mt-1"><span className="font-semibold">Contraindications:</span> {result.contraindications}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white/90 border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800">Ingested Documents</h2>
            {loading ? (
              <div className="text-sm text-slate-500 mt-3">Loading documents...</div>
            ) : documents.length === 0 ? (
              <div className="text-sm text-slate-500 mt-3">No documents yet. Add a guideline or protocol.</div>
            ) : (
              <div className="mt-3 space-y-3">
                {documents.map(doc => (
                  <div key={doc.id} className="border border-slate-200 rounded-xl p-4 bg-white">
                    <div className="text-sm font-semibold text-slate-900">{doc.title}</div>
                    <div className="text-xs text-slate-500">{doc.subspecialty || 'General'} • {doc.version || 'v1'}</div>
                    <div className="text-xs text-slate-400">Added {new Date(doc.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="bg-white/90 border border-slate-200 rounded-2xl p-6 shadow-sm h-fit">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Add Knowledge</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">Title</label>
              <input
                value={form.title}
                onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))}
                className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Subspecialty</label>
              <input
                value={form.subspecialty}
                onChange={event => setForm(prev => ({ ...prev, subspecialty: event.target.value }))}
                className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Sports, spine, trauma"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Diagnosis Tags</label>
              <input
                value={form.diagnosisTags}
                onChange={event => setForm(prev => ({ ...prev, diagnosisTags: event.target.value }))}
                className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="ACL, rotator cuff"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Source</label>
              <input
                value={form.source}
                onChange={event => setForm(prev => ({ ...prev, source: event.target.value }))}
                className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="AAOS CPG"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Version</label>
              <input
                value={form.version}
                onChange={event => setForm(prev => ({ ...prev, version: event.target.value }))}
                className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="2024"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Content</label>
              <textarea
                value={form.content}
                onChange={event => setForm(prev => ({ ...prev, content: event.target.value }))}
                className="w-full mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-40"
                placeholder="Paste guideline or protocol text"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-teal text-white text-sm font-semibold py-2.5 hover:bg-teal/90 disabled:opacity-60"
            >
              {saving ? 'Ingesting...' : 'Ingest Document'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-800">Phase 5 Controls</h3>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={runSeedPhase5}
                disabled={syncBusy}
                className="rounded-xl bg-slate-900 text-white text-xs font-semibold py-2.5 disabled:opacity-60"
              >
                Seed Guideline + Reference Frameworks
              </button>
              <button
                onClick={() => queueEvidenceSync('pubmed')}
                disabled={syncBusy}
                className="rounded-xl bg-teal text-white text-xs font-semibold py-2.5 disabled:opacity-60"
              >
                Queue PubMed Sync Job
              </button>
              <button
                onClick={() => queueEvidenceSync('cochrane')}
                disabled={syncBusy}
                className="rounded-xl bg-cyan-700 text-white text-xs font-semibold py-2.5 disabled:opacity-60"
              >
                Queue Cochrane Sync Job
              </button>
              <button
                onClick={runProcessNextJob}
                disabled={syncBusy}
                className="rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-semibold py-2.5 disabled:opacity-60"
              >
                Process Next Sync Job
              </button>
            </div>
            {syncMessage && (
              <div className="text-xs text-slate-700 bg-slate-100 rounded-lg px-3 py-2">
                {syncMessage}
              </div>
            )}
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-2">Source Status</div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {sources.map(source => (
                  <div key={source.source_key} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                    <div className="text-[11px] font-semibold text-slate-800">{source.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {source.category} • {source.enabled ? 'enabled' : 'disabled'} • {source.last_synced_at ? new Date(source.last_synced_at).toLocaleDateString() : 'never synced'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-2">Recent Sync Jobs</div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {syncJobs.map(job => (
                  <div key={job.id} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                    <div className="text-[11px] font-semibold text-slate-800">
                      {job.job_type} {job.source_key ? `(${job.source_key})` : ''}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {job.status} • ingested {job.records_ingested} • {new Date(job.created_at).toLocaleString()}
                    </div>
                    {job.error_message && (
                      <div className="text-[10px] text-red-600 mt-1">{job.error_message}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
