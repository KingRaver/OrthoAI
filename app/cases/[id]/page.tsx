'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import CaseForm from '@/components/CaseForm';
import CaseTimeline from '@/components/CaseTimeline';
import type { PatientCase, CaseEvent } from '@/app/lib/cases/types';

interface ConversationLink {
  conversation_id: string;
  created_at: string;
}

interface ImagingStudy {
  id: string;
  study_type: string;
  modality: string | null;
  body_part: string | null;
  study_date: string | null;
  description: string | null;
}

interface CaseDashboard {
  overview: {
    timelineDays: number;
    totalEvents: number;
    keyMetrics: Array<{ label: string; value: string | number }>;
  };
  treatmentProgress: Array<{
    phase: string;
    completed: boolean;
    completedAt?: string;
  }>;
  alerts: Array<{
    level: 'low' | 'moderate' | 'high' | 'critical';
    message: string;
  }>;
}

function toDisplayValue(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params?.id as string;

  const [patientCase, setPatientCase] = useState<PatientCase | null>(null);
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [links, setLinks] = useState<ConversationLink[]>([]);
  const [dashboard, setDashboard] = useState<CaseDashboard | null>(null);
  const [imagingStudies, setImagingStudies] = useState<ImagingStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [conversationId, setConversationId] = useState('');
  const [linkingConversation, setLinkingConversation] = useState(false);
  const [newStudyType, setNewStudyType] = useState('');
  const [newStudyModality, setNewStudyModality] = useState('');
  const [newStudyBodyPart, setNewStudyBodyPart] = useState('');
  const [addingStudy, setAddingStudy] = useState(false);

  const fetchCase = useCallback(async () => {
    setLoading(true);
    try {
      const [caseResponse, dashboardResponse, imagingResponse] = await Promise.all([
        fetch(`/api/cases/${caseId}`),
        fetch(`/api/cases/${caseId}/dashboard`),
        fetch(`/api/imaging?caseId=${caseId}&limit=100`),
      ]);

      if (!caseResponse.ok) throw new Error('Failed to fetch case');

      const caseData = await caseResponse.json();
      setPatientCase(caseData.case || null);
      setEvents(caseData.events || []);
      setLinks(caseData.conversations || []);

      if (dashboardResponse.ok) {
        const dashboardData = await dashboardResponse.json();
        setDashboard(dashboardData.dashboard || null);
      } else {
        setDashboard(null);
      }

      if (imagingResponse.ok) {
        const imagingData = await imagingResponse.json();
        setImagingStudies(imagingData.studies || []);
      } else {
        setImagingStudies([]);
      }
    } catch (error) {
      console.error('Error fetching case:', error);
      setPatientCase(null);
      setDashboard(null);
      setImagingStudies([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (caseId) {
      fetchCase();
    }
  }, [caseId, fetchCase]);

  const handleCaseSaved = (updatedCase: PatientCase) => {
    setPatientCase(updatedCase);
    setIsEditing(false);
  };

  const handleCaseDeleted = () => {
    router.push('/cases');
  };

  const handleEventAdded = (event: CaseEvent) => {
    setEvents(prev => [...prev, event].sort((a, b) => {
      const dateA = a.occurred_at || a.created_at;
      const dateB = b.occurred_at || b.created_at;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    }));
  };

  const linkConversation = async () => {
    if (!conversationId.trim()) return;
    setLinkingConversation(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conversationId.trim() })
      });
      if (response.ok) {
        setConversationId('');
        await fetchCase();
      }
    } catch (error) {
      console.error('Error linking conversation:', error);
    } finally {
      setLinkingConversation(false);
    }
  };

  const exportSummary = () => {
    window.open(`/api/cases/${caseId}/export`, '_blank');
  };

  const addImagingStudy = async () => {
    if (!newStudyType.trim()) return;
    setAddingStudy(true);
    try {
      const response = await fetch('/api/imaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          study_type: newStudyType.trim(),
          modality: newStudyModality.trim() || null,
          body_part: newStudyBodyPart.trim() || null,
          study_date: new Date().toISOString(),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add imaging study');
      }
      setNewStudyType('');
      setNewStudyModality('');
      setNewStudyBodyPart('');
      await fetchCase();
    } catch (error) {
      console.error('Error adding imaging study:', error);
    } finally {
      setAddingStudy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-cyan-50/30 to-slate-50">
        <div className="flex items-center justify-center h-screen">
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-cyan-light rounded-full animate-bounce [animation-delay:0s]" />
            <div className="w-3 h-3 bg-teal rounded-full animate-bounce [animation-delay:0.1s]" />
            <div className="w-3 h-3 bg-yellow rounded-full animate-bounce [animation-delay:0.2s]" />
          </div>
        </div>
      </div>
    );
  }

  if (!patientCase) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-cyan-50/30 to-slate-50 p-8">
        <div className="max-w-2xl mx-auto text-center py-16">
          <div className="text-6xl mb-4">📋</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Case Not Found</h1>
          <p className="text-slate-500 mb-6">The case you are looking for does not exist or has been deleted.</p>
          <Link
            href="/cases"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal text-white font-medium hover:bg-teal/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Cases
          </Link>
        </div>
      </div>
    );
  }

  const demographics = patientCase.demographics as Record<string, unknown> | null;
  const demographicAge = toDisplayValue(demographics?.age);
  const demographicSex = toDisplayValue(demographics?.sex);
  const demographicOccupation = toDisplayValue(demographics?.occupation);
  const hasDemographics = Boolean(demographicAge || demographicSex || demographicOccupation);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-cyan-50/30 to-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <Link
            href="/cases"
            className="flex items-center gap-2 text-slate-600 hover:text-teal transition-colors group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-medium">Back to Cases</span>
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-50 transition-colors"
            >
              {isEditing ? 'Cancel Edit' : 'Edit Case'}
            </button>
            <button
              onClick={exportSummary}
              className="text-xs font-semibold text-white bg-teal px-3 py-1.5 rounded-full hover:bg-teal/90 transition-colors"
            >
              Export Summary
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">
        {isEditing ? (
          <div className="max-w-2xl mx-auto">
            <CaseForm
              initialCase={patientCase}
              onSave={handleCaseSaved}
              onCancel={() => setIsEditing(false)}
              onDelete={handleCaseDeleted}
            />
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
            {/* Main content */}
            <div className="space-y-6">
              {/* Case header */}
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-xl font-bold text-slate-900">{patientCase.title}</h1>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        patientCase.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}>
                        {patientCase.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Created {new Date(patientCase.created_at).toLocaleDateString()} •
                      Updated {new Date(patientCase.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Demographics */}
                {hasDemographics && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    {demographicAge && (
                      <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-sm">
                        <span className="text-slate-500">Age:</span>{' '}
                        <span className="font-medium text-slate-700">{demographicAge}</span>
                      </div>
                    )}
                    {demographicSex && (
                      <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-sm">
                        <span className="text-slate-500">Sex:</span>{' '}
                        <span className="font-medium text-slate-700">{demographicSex}</span>
                      </div>
                    )}
                    {demographicOccupation && (
                      <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-sm">
                        <span className="text-slate-500">Occupation:</span>{' '}
                        <span className="font-medium text-slate-700">{demographicOccupation}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tags */}
                {patientCase.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {patientCase.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-light/30 text-teal"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Clinical details */}
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm space-y-5">
                {patientCase.complaints && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Chief Complaint</h3>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{patientCase.complaints}</p>
                  </div>
                )}
                {patientCase.history && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Relevant History</h3>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{patientCase.history}</p>
                  </div>
                )}
                {(patientCase.medications || patientCase.allergies) && (
                  <div className="grid grid-cols-2 gap-4">
                    {patientCase.medications && (
                      <div>
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Medications</h3>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{patientCase.medications}</p>
                      </div>
                    )}
                    {patientCase.allergies && (
                      <div>
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Allergies</h3>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{patientCase.allergies}</p>
                      </div>
                    )}
                  </div>
                )}
                {!patientCase.complaints && !patientCase.history && !patientCase.medications && !patientCase.allergies && (
                  <p className="text-sm text-slate-400 text-center py-4">
                    No clinical details recorded. Click Edit Case to add information.
                  </p>
                )}
              </div>

              {/* Timeline */}
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
                <CaseTimeline
                  events={events}
                  caseId={caseId}
                  onEventAdded={handleEventAdded}
                />
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Linked Conversations */}
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Linked Conversations</h3>

                {links.length === 0 ? (
                  <p className="text-sm text-slate-500 mb-4">
                    No conversations linked yet. Link a conversation to associate chat history with this case.
                  </p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {links.map(link => (
                      <div
                        key={link.conversation_id}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-slate-600 truncate">
                            {link.conversation_id}
                          </p>
                          <p className="text-xs text-slate-400">
                            Linked {new Date(link.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Link
                          href={`/?conversation=${link.conversation_id}`}
                          className="ml-2 text-xs font-medium text-teal hover:underline"
                        >
                          Open
                        </Link>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={conversationId}
                    onChange={(e) => setConversationId(e.target.value)}
                    placeholder="Conversation ID"
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-medium bg-white text-slate-900 border-2 border-slate-900/40 hover:border-slate-900/70 focus:outline-none focus:ring-2 focus:ring-teal/60"
                  />
                  <button
                    onClick={linkConversation}
                    disabled={linkingConversation || !conversationId.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-linear-to-r from-teal/80 to-cyan-light/80 text-slate-900 border-2 border-slate-900/50 hover:border-slate-900/80 transition-all disabled:opacity-40"
                  >
                    {linkingConversation ? '...' : 'Link'}
                  </button>
                </div>
              </div>

              {/* Clinical Dashboard */}
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Clinical Dashboard</h3>
                {dashboard ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                        <p className="text-slate-500">Timeline</p>
                        <p className="font-semibold text-slate-800">{dashboard.overview.timelineDays} days</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
                        <p className="text-slate-500">Events</p>
                        <p className="font-semibold text-slate-800">{dashboard.overview.totalEvents}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1">Treatment Progress</p>
                      <div className="space-y-1">
                        {dashboard.treatmentProgress.map(item => (
                          <div key={item.phase} className="flex items-center justify-between text-xs rounded-md border border-slate-200 px-2 py-1">
                            <span className="text-slate-700">{item.phase}</span>
                            <span className={item.completed ? 'text-green-700 font-semibold' : 'text-slate-400'}>
                              {item.completed ? 'Done' : 'Pending'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-1">Alerts</p>
                      {dashboard.alerts.length === 0 ? (
                        <p className="text-xs text-slate-500">No active alerts.</p>
                      ) : (
                        <div className="space-y-1">
                          {dashboard.alerts.map((alert, idx) => (
                            <div key={`${alert.message}-${idx}`} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                              {alert.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Dashboard data unavailable.</p>
                )}
              </div>

              {/* Imaging Studies */}
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Imaging Studies</h3>
                {imagingStudies.length === 0 ? (
                  <p className="text-sm text-slate-500 mb-4">No imaging studies linked to this case yet.</p>
                ) : (
                  <div className="space-y-2 mb-4 max-h-56 overflow-y-auto pr-1">
                    {imagingStudies.map(study => (
                      <div key={study.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-800">
                          {study.study_type} {study.modality ? `• ${study.modality}` : ''}
                        </p>
                        <p className="text-xs text-slate-500">
                          {study.body_part || 'Body part n/a'} {study.study_date ? `• ${new Date(study.study_date).toLocaleDateString()}` : ''}
                        </p>
                        {study.description && (
                          <p className="text-xs text-slate-600 mt-1">{study.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <input
                    type="text"
                    value={newStudyType}
                    onChange={(e) => setNewStudyType(e.target.value)}
                    placeholder="Study type (e.g., MRI knee)"
                    className="w-full px-3 py-2 rounded-xl text-xs font-medium bg-white text-slate-900 border-2 border-slate-900/40 hover:border-slate-900/70 focus:outline-none focus:ring-2 focus:ring-teal/60"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newStudyModality}
                      onChange={(e) => setNewStudyModality(e.target.value)}
                      placeholder="Modality"
                      className="px-3 py-2 rounded-xl text-xs font-medium bg-white text-slate-900 border-2 border-slate-900/40 hover:border-slate-900/70 focus:outline-none focus:ring-2 focus:ring-teal/60"
                    />
                    <input
                      type="text"
                      value={newStudyBodyPart}
                      onChange={(e) => setNewStudyBodyPart(e.target.value)}
                      placeholder="Body part"
                      className="px-3 py-2 rounded-xl text-xs font-medium bg-white text-slate-900 border-2 border-slate-900/40 hover:border-slate-900/70 focus:outline-none focus:ring-2 focus:ring-teal/60"
                    />
                  </div>
                  <button
                    onClick={addImagingStudy}
                    disabled={addingStudy || !newStudyType.trim()}
                    className="w-full px-4 py-2 rounded-xl text-xs font-bold bg-linear-to-r from-teal/80 to-cyan-light/80 text-slate-900 border-2 border-slate-900/50 hover:border-slate-900/80 transition-all disabled:opacity-40"
                  >
                    {addingStudy ? 'Adding...' : 'Add Imaging Study'}
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <Link
                    href={`/?case=${caseId}`}
                    className="flex items-center gap-3 w-full p-3 rounded-xl bg-linear-to-r from-yellow/20 to-peach/20 border border-slate-200 hover:shadow-md transition-all group"
                  >
                    <span className="text-xl">💬</span>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-slate-900">Start Chat with Context</p>
                      <p className="text-xs text-slate-500">Begin a new conversation about this case</p>
                    </div>
                    <svg className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-3 w-full p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all group"
                  >
                    <span className="text-xl">✏️</span>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-slate-900">Edit Case Details</p>
                      <p className="text-xs text-slate-500">Update patient information</p>
                    </div>
                    <svg className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <Link
                    href={`/api/cases/${caseId}/decision-support`}
                    target="_blank"
                    className="flex items-center gap-3 w-full p-3 rounded-xl bg-teal/10 border border-teal/30 hover:bg-teal/20 transition-all group"
                  >
                    <span className="text-xl">🧭</span>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-slate-900">Case Decision Support</p>
                      <p className="text-xs text-slate-500">Flowchart, differential, workup, and risk bundle</p>
                    </div>
                    <svg className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
