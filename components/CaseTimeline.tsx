'use client';

import { useState } from 'react';
import type { CaseEvent } from '@/app/lib/cases/types';

interface CaseTimelineProps {
  events: CaseEvent[];
  caseId: string;
  onEventAdded?: (event: CaseEvent) => void;
}

const EVENT_TYPES = [
  { value: 'injury', label: 'Injury', icon: '🤕', color: 'bg-red-100 text-red-700 border-red-300' },
  { value: 'consultation', label: 'Consultation', icon: '🩺', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'imaging', label: 'Imaging', icon: '🔬', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  { value: 'diagnosis', label: 'Diagnosis', icon: '📋', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'treatment', label: 'Treatment', icon: '💊', color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'surgery', label: 'Surgery', icon: '🏥', color: 'bg-pink-100 text-pink-700 border-pink-300' },
  { value: 'rehab', label: 'Rehab', icon: '🏃', color: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
  { value: 'follow-up', label: 'Follow-up', icon: '📅', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'outcome', label: 'Outcome', icon: '✅', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'other', label: 'Other', icon: '📝', color: 'bg-slate-100 text-slate-700 border-slate-300' },
];

const getEventStyle = (eventType: string) => {
  const found = EVENT_TYPES.find(t => t.value === eventType);
  return found || EVENT_TYPES[EVENT_TYPES.length - 1];
};

export default function CaseTimeline({ events, caseId, onEventAdded }: CaseTimelineProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    event_type: 'consultation',
    summary: '',
    occurred_at: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedEvents = [...events].sort((a, b) => {
    const dateA = a.occurred_at || a.created_at;
    const dateB = b.occurred_at || b.created_at;
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });

  const handleAddEvent = async () => {
    if (!newEvent.summary.trim()) {
      setError('Event summary is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/cases/${caseId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: newEvent.event_type,
          summary: newEvent.summary.trim(),
          occurred_at: newEvent.occurred_at ? new Date(newEvent.occurred_at).toISOString() : null,
        }),
      });

      if (!res.ok) throw new Error('Failed to add event');

      const data = await res.json();
      onEventAdded?.(data.event);
      setNewEvent({
        event_type: 'consultation',
        summary: '',
        occurred_at: new Date().toISOString().split('T')[0],
      });
      setShowAddForm(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-900">Case Timeline</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1 rounded-lg text-xs font-bold bg-linear-to-r from-teal/80 to-cyan-light/80 text-slate-900 border-2 border-slate-900/50 hover:border-slate-900/80 transition-all"
        >
          {showAddForm ? 'Cancel' : '+ Add Event'}
        </button>
      </div>

      {/* Add Event Form */}
      {showAddForm && (
        <div className="mb-6 p-4 rounded-xl bg-white/80 border-2 border-slate-200">
          {error && (
            <div className="mb-3 p-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Event Type</label>
                <select
                  value={newEvent.event_type}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, event_type: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-900 border-2 border-slate-900/40 focus:outline-none focus:ring-2 focus:ring-teal/60 cursor-pointer"
                >
                  {EVENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={newEvent.occurred_at}
                  onChange={(e) => setNewEvent(prev => ({ ...prev, occurred_at: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-900 border-2 border-slate-900/40 focus:outline-none focus:ring-2 focus:ring-teal/60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Summary</label>
              <textarea
                value={newEvent.summary}
                onChange={(e) => setNewEvent(prev => ({ ...prev, summary: e.target.value }))}
                placeholder="Describe what happened..."
                rows={2}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-900 border-2 border-slate-900/40 focus:outline-none focus:ring-2 focus:ring-teal/60 resize-none"
              />
            </div>

            <button
              onClick={handleAddEvent}
              disabled={loading}
              className="w-full px-4 py-2 rounded-lg text-xs font-bold bg-linear-to-r from-yellow/90 to-peach/90 text-slate-900 border-2 border-slate-900/20 hover:shadow-md transition-all disabled:opacity-40"
            >
              {loading ? 'Adding...' : 'Add Event'}
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {sortedEvents.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          No events recorded yet. Add your first event to start the timeline.
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />

          {sortedEvents.map((event) => {
            const style = getEventStyle(event.event_type);
            return (
              <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                {/* Dot on timeline */}
                <div
                  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 ${style.color}`}
                >
                  {style.icon}
                </div>

                {/* Event card */}
                <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.color}`}
                        >
                          {style.label}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDate(event.occurred_at || event.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{event.summary}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
