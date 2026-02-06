'use client';

import { useState, useEffect } from 'react';
import type { PatientCase } from '@/app/lib/cases/types';

interface CaseListProps {
  onSelectCase?: (patientCase: PatientCase) => void;
  onCreateNew?: () => void;
  selectedCaseId?: string | null;
}

export default function CaseList({ onSelectCase, onCreateNew, selectedCaseId }: CaseListProps) {
  const [cases, setCases] = useState<PatientCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cases?limit=100');
      if (!res.ok) throw new Error('Failed to load cases');
      const data = await res.json();
      setCases(data.cases || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCases = cases.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        c.title.toLowerCase().includes(term) ||
        c.complaints?.toLowerCase().includes(term) ||
        c.tags.some(t => t.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex space-x-2">
          <div className="w-2.5 h-2.5 bg-cyan-light rounded-full animate-bounce [animation-delay:0s]" />
          <div className="w-2.5 h-2.5 bg-teal rounded-full animate-bounce [animation-delay:0.1s]" />
          <div className="w-2.5 h-2.5 bg-yellow rounded-full animate-bounce [animation-delay:0.2s]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-600 text-sm">
        {error}
        <button
          onClick={loadCases}
          className="ml-2 text-teal hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with search and filter */}
      <div className="p-4 border-b border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Patient Cases</h2>
          {onCreateNew && (
            <button
              onClick={onCreateNew}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-linear-to-r from-teal/80 to-cyan-light/80 text-slate-900 border-2 border-slate-900/50 hover:border-slate-900/80 transition-all shadow-sm hover:shadow-md"
            >
              + New Case
            </button>
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search cases..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-xs font-medium bg-white/70 text-slate-900 border-2 border-slate-900/40 hover:bg-white hover:border-slate-900/70 focus:outline-none focus:ring-2 focus:ring-teal/60"
        />

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['all', 'active', 'closed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                filter === f
                  ? 'bg-linear-to-r from-teal/80 to-cyan-light/80 text-slate-900 border-2 border-slate-900/70'
                  : 'bg-white/60 text-slate-600 border-2 border-slate-900/40 hover:border-slate-900/70'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Case list */}
      <div className="flex-1 overflow-y-auto">
        {filteredCases.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            {cases.length === 0 ? 'No cases yet. Create your first case!' : 'No cases match your filter.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCases.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectCase?.(c)}
                className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${
                  selectedCaseId === c.id ? 'bg-teal/10 border-l-4 border-teal' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{c.title}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    {c.complaints && (
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{c.complaints}</p>
                    )}
                    {c.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {c.tags.slice(0, 3).map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full text-xs bg-cyan-light/30 text-teal font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                        {c.tags.length > 3 && (
                          <span className="text-xs text-slate-400">+{c.tags.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 whitespace-nowrap ml-2">
                    {formatDate(c.updated_at)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="p-3 border-t border-slate-200 text-xs text-slate-500 text-center">
        {filteredCases.length} of {cases.length} cases
      </div>
    </div>
  );
}
