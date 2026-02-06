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

  const fetchDocs = async (signal?: AbortSignal) => {
    const response = await fetch('/api/knowledge', { signal });
    if (!response.ok) {
      throw new Error('Failed to load knowledge documents');
    }
    const data = await response.json();
    return (data.documents || []) as KnowledgeDocument[];
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
        </aside>
      </div>
    </div>
  );
}
