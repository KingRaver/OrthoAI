'use client';

import { useState, useEffect } from 'react';
import type { PatientCase } from '@/app/lib/cases/types';

interface CaseFormProps {
  initialCase?: PatientCase | null;
  onSave?: (patientCase: PatientCase) => void;
  onCancel?: () => void;
  onDelete?: (caseId: string) => void;
}

interface FormData {
  title: string;
  status: 'active' | 'closed';
  complaints: string;
  history: string;
  medications: string;
  allergies: string;
  demographics: {
    age: string;
    sex: string;
    occupation: string;
  };
  tags: string;
}

export default function CaseForm({ initialCase, onSave, onCancel, onDelete }: CaseFormProps) {
  const [form, setForm] = useState<FormData>({
    title: '',
    status: 'active',
    complaints: '',
    history: '',
    medications: '',
    allergies: '',
    demographics: { age: '', sex: '', occupation: '' },
    tags: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (initialCase) {
      const demographics = initialCase.demographics ?? {};
      const demographyRecord = (demographics && typeof demographics === 'object')
        ? (demographics as Record<string, unknown>)
        : {};
      const ageRaw = demographyRecord.age;
      const sexRaw = demographyRecord.sex;
      const occupationRaw = demographyRecord.occupation;
      setForm({
        title: initialCase.title || '',
        status: initialCase.status || 'active',
        complaints: initialCase.complaints || '',
        history: initialCase.history || '',
        medications: initialCase.medications || '',
        allergies: initialCase.allergies || '',
        demographics: {
          age: ageRaw === null || ageRaw === undefined ? '' : String(ageRaw),
          sex: typeof sexRaw === 'string' ? sexRaw : '',
          occupation: typeof occupationRaw === 'string' ? occupationRaw : '',
        },
        tags: initialCase.tags?.join(', ') || '',
      });
    }
  }, [initialCase]);

  const handleChange = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleDemographicsChange = (key: string, value: string) => {
    setForm(prev => ({
      ...prev,
      demographics: { ...prev.demographics, [key]: value },
    }));
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError('Case title is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        title: form.title.trim(),
        status: form.status,
        complaints: form.complaints.trim() || null,
        history: form.history.trim() || null,
        medications: form.medications.trim() || null,
        allergies: form.allergies.trim() || null,
        demographics: {
          age: form.demographics.age ? parseInt(form.demographics.age) : null,
          sex: form.demographics.sex || null,
          occupation: form.demographics.occupation || null,
        },
        tags: form.tags
          .split(',')
          .map(t => t.trim())
          .filter(Boolean),
      };

      const url = initialCase ? `/api/cases/${initialCase.id}` : '/api/cases';
      const method = initialCase ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save case');
      }

      const data = await res.json();
      onSave?.(data.case);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialCase) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/cases/${initialCase.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete case');
      onDelete?.(initialCase.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="rounded-3xl border-2 border-slate-900/40 bg-linear-to-b from-cyan-light/30 via-white/70 to-peach/40 shadow-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-900">
          {initialCase ? 'Edit Case' : 'New Case'}
        </h2>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-700 text-sm"
          >
            Cancel
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Case Title *
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="e.g., 45yo M - Left Knee ACL Tear"
            className="w-full px-3 py-2 rounded-xl text-sm font-medium bg-white/70 text-slate-900 border-2 border-slate-900/40 hover:bg-white hover:border-slate-900/70 focus:outline-none focus:ring-2 focus:ring-teal/60"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => handleChange('status', e.target.value as 'active' | 'closed')}
            className="w-full px-3 py-2 rounded-xl text-sm font-medium bg-white/70 text-slate-900 border-2 border-slate-900/40 hover:bg-white hover:border-slate-900/70 focus:outline-none focus:ring-2 focus:ring-teal/60 cursor-pointer"
          >
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {/* Demographics */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Demographics</label>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              value={form.demographics.age}
              onChange={(e) => handleDemographicsChange('age', e.target.value)}
              placeholder="Age"
              className="px-3 py-2 rounded-xl text-sm font-medium bg-white/70 text-slate-900 border-2 border-slate-900/40 hover:bg-white hover:border-slate-900/70 focus:outline-none focus:ring-2 focus:ring-teal/60"
            />
            <select
              value={form.demographics.sex}
              onChange={(e) => handleDemographicsChange('sex', e.target.value)}
              className="px-3 py-2 rounded-xl text-sm font-medium bg-white/70 text-slate-900 border-2 border-slate-900/40 hover:bg-white hover:border-slate-900/70 focus:outline-none focus:ring-2 focus:ring-teal/60 cursor-pointer"
            >
              <option value="">Sex</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
            <input
              type="text"
              value={form.demographics.occupation}
              onChange={(e) => handleDemographicsChange('occupation', e.target.value)}
              placeholder="Occupation"
              className="px-3 py-2 rounded-xl text-sm font-medium bg-white/70 text-slate-900 border-2 border-slate-900/40 hover:bg-white hover:border-slate-900/70 focus:outline-none focus:ring-2 focus:ring-teal/60"
            />
          </div>
        </div>

        {/* Chief Complaint */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Chief Complaint
          </label>
          <textarea
            value={form.complaints}
            onChange={(e) => handleChange('complaints', e.target.value)}
            placeholder="Primary presenting symptoms and concerns..."
            rows={3}
            className="w-full px-3 py-2 rounded-xl text-sm font-medium bg-white/70 text-slate-900 border-2 border-slate-900/40 hover:bg-white hover:border-slate-900/70 focus:outline-none focus:ring-2 focus:ring-teal/60 resize-none"
          />
        </div>

        {/* History */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Relevant History
          </label>
          <textarea
            value={form.history}
            onChange={(e) => handleChange('history', e.target.value)}
            placeholder="Mechanism of injury, prior treatments, surgical history..."
            rows={3}
            className="w-full px-3 py-2 rounded-xl text-sm font-medium bg-white/70 text-slate-900 border-2 border-slate-900/40 hover:bg-white hover:border-slate-900/70 focus:outline-none focus:ring-2 focus:ring-teal/60 resize-none"
          />
        </div>

        {/* Medications & Allergies */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Medications
            </label>
            <textarea
              value={form.medications}
              onChange={(e) => handleChange('medications', e.target.value)}
              placeholder="Current medications..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl text-sm font-medium bg-white/70 text-slate-900 border-2 border-slate-900/40 hover:bg-white hover:border-slate-900/70 focus:outline-none focus:ring-2 focus:ring-teal/60 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Allergies
            </label>
            <textarea
              value={form.allergies}
              onChange={(e) => handleChange('allergies', e.target.value)}
              placeholder="Known allergies..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl text-sm font-medium bg-white/70 text-slate-900 border-2 border-slate-900/40 hover:bg-white hover:border-slate-900/70 focus:outline-none focus:ring-2 focus:ring-teal/60 resize-none"
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            value={form.tags}
            onChange={(e) => handleChange('tags', e.target.value)}
            placeholder="e.g., ACL, sports, surgical candidate"
            className="w-full px-3 py-2 rounded-xl text-sm font-medium bg-white/70 text-slate-900 border-2 border-slate-900/40 hover:bg-white hover:border-slate-900/70 focus:outline-none focus:ring-2 focus:ring-teal/60"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-between">
        <div>
          {initialCase && onDelete && (
            <>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600">Delete case?</span>
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-2 py-1 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-600 transition-all"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition-all"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white/80 text-red-600 border border-red-600/50 hover:bg-red-50 transition-all"
                >
                  Delete Case
                </button>
              )}
            </>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-6 py-2 bg-linear-to-r from-yellow/90 to-peach/90 text-slate-900 font-bold rounded-xl shadow-lg hover:shadow-yellow/40 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95 text-sm tracking-wide border-2 border-slate-900/20"
        >
          {loading ? 'Saving...' : initialCase ? 'Update Case' : 'Create Case'}
        </button>
      </div>
    </div>
  );
}
