// components/LeftToolbar.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { PatientCase } from '@/app/lib/cases/types';

interface UserProfile {
  clinicalFocus?: string;
  researchFocus?: string;
  preferredEvidence?: string;
  dataSources?: string;
  notes?: string;
}

export interface ToolbarSettings {
  manualMode:
    | ''
    | 'clinical-consult'
    | 'treatment-decision'
    | 'surgical-planning'
    | 'complications-risk'
    | 'imaging-dx'
    | 'rehab-rtp'
    | 'evidence-brief';
  enableTools: boolean;
  voiceEnabled: boolean;
  memoryConsent: boolean;
  selectedCaseId: string | null;
}

interface PatientCaseOption {
  id: string;
  title: string;
  status: 'active' | 'closed';
}

interface LeftToolbarProps {
  onSettingsChange: (settings: ToolbarSettings) => void;
}

type CasesResponse = {
  cases?: PatientCase[];
};

export default function LeftToolbar({
  onSettingsChange,
}: LeftToolbarProps) {
  // LeftToolbar owns all settings state
  const [settings, setSettings] = useState<ToolbarSettings>({
    manualMode: '',
    enableTools: false,
    voiceEnabled: false,
    memoryConsent: false,
    selectedCaseId: null,
  });

  // Case selector state
  const [cases, setCases] = useState<PatientCaseOption[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesExpanded, setCasesExpanded] = useState(false);

  // Profile state
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  // Load memory consent preference on mount
  useEffect(() => {
    const loadConsent = async () => {
      try {
        const response = await fetch('/api/memory/consent');
        if (!response.ok) return;
        const data = await response.json();
        setSettings(prev => ({ ...prev, memoryConsent: Boolean(data?.consent) }));
      } catch (error) {
        console.warn('[LeftToolbar] Failed to load memory consent:', error);
      }
    };
    loadConsent();
  }, []);

  // Load cases when case selector is expanded
  useEffect(() => {
    const loadCases = async () => {
      if (!casesExpanded) return;
      setCasesLoading(true);
      try {
        const response = await fetch('/api/cases?limit=50');
        if (response.ok) {
          const data = (await response.json()) as CasesResponse;
          const caseList = Array.isArray(data.cases) ? data.cases : [];
          setCases(
            caseList.map(({ id, title, status }) => ({ id, title, status }))
          );
        }
      } catch (error) {
        console.warn('[LeftToolbar] Failed to load cases:', error);
      } finally {
        setCasesLoading(false);
      }
    };
    loadCases();
  }, [casesExpanded]);

  // Load profile when expanded and consent is granted
  useEffect(() => {
    const loadProfile = async () => {
      if (!profileExpanded || !settings.memoryConsent) return;

      setProfileLoading(true);
      try {
        const response = await fetch('/api/profile');
        if (response.ok) {
          const data = await response.json();
          if (data.profile) {
            // Parse the profile string into structured fields
            setProfile(data.profile);
          }
        }
      } catch (error) {
        console.warn('[LeftToolbar] Failed to load profile:', error);
      } finally {
        setProfileLoading(false);
      }
    };
    loadProfile();
  }, [profileExpanded, settings.memoryConsent]);

  // Notify Chat whenever settings change
  useEffect(() => {
    onSettingsChange(settings);
  }, [settings, onSettingsChange]);

  // Update individual settings
  const updateSetting = <K extends keyof ToolbarSettings>(
    key: K,
    value: ToolbarSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Handle memory consent toggle with API call
  const handleMemoryConsentToggle = async () => {
    const next = !settings.memoryConsent;
    updateSetting('memoryConsent', next);
    try {
      const response = await fetch('/api/memory/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: next }),
      });
      if (!response.ok) {
        updateSetting('memoryConsent', !next); // Revert on error
      }
      // Clear profile when consent revoked
      if (!next) {
        setProfile({});
        setProfileExpanded(false);
      }
    } catch (error) {
      console.warn('[LeftToolbar] Failed to update memory consent:', error);
      updateSetting('memoryConsent', !next); // Revert on error
    }
  };

  // Handle profile updates
  const handleProfileChange = (field: keyof UserProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  // Save profile to backend
  const handleSaveProfile = async () => {
    if (!settings.memoryConsent) {
      alert('Please enable Memory consent first');
      return;
    }

    setProfileSaving(true);
    try {
      // Convert structured profile to string format for backend
      const profileText = Object.entries(profile)
        .filter(([, value]) => value && value.trim())
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');

      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profileText, consent: settings.memoryConsent }),
      });

      if (response.ok) {
        console.log('[LeftToolbar] Profile saved successfully');
      } else {
        console.error('[LeftToolbar] Failed to save profile');
      }
    } catch (error) {
      console.error('[LeftToolbar] Error saving profile:', error);
    } finally {
      setProfileSaving(false);
    }
  };

  // Clear profile
  const handleClearProfile = async () => {
    if (!confirm('Clear your profile data? This cannot be undone.')) return;

    try {
      const response = await fetch('/api/profile', { method: 'DELETE' });
      if (response.ok) {
        setProfile({});
        console.log('[LeftToolbar] Profile cleared');
      }
    } catch (error) {
      console.error('[LeftToolbar] Error clearing profile:', error);
    }
  };

  const toggleStyle =
    'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all duration-200 shadow-sm hover:shadow-md active:scale-95';

  return (
    <>
      {/* Desktop: Vertical Tool Rail */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 overflow-y-auto max-h-[calc(100vh-10rem)]">
        <div className="rounded-3xl border-2 border-slate-900/40 bg-linear-to-b from-cyan-light/30 via-white/70 to-peach/40 shadow-xl p-4">
          <div className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
            Tool Rail
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <select
              value={settings.manualMode}
              onChange={(e) =>
                updateSetting(
                  'manualMode',
                  e.target.value as
                    | ''
                    | 'clinical-consult'
                    | 'treatment-decision'
                    | 'surgical-planning'
                    | 'complications-risk'
                    | 'imaging-dx'
                    | 'rehab-rtp'
                    | 'evidence-brief'
                )
              }
              className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white/70 text-slate-900 border-2 border-slate-900/40 hover:bg-white hover:border-slate-900/70 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-900/60 cursor-pointer shadow-sm hover:shadow-md"
              title="Mode: Auto-detect or select clinical consult, treatment decision, surgical planning, complications/risk, imaging dx, rehab/RTP, or evidence brief"
            >
              <option value="" className="bg-white text-slate-900 font-bold">
                🤖 Auto
              </option>
              <option value="clinical-consult" className="bg-white text-slate-900 font-bold">
                🩺 Clinical Consult
              </option>
              <option value="treatment-decision" className="bg-white text-slate-900 font-bold">
                ⚖️ Treatment Decision
              </option>
              <option value="surgical-planning" className="bg-white text-slate-900 font-bold">
                🧰 Surgical Planning
              </option>
              <option value="complications-risk" className="bg-white text-slate-900 font-bold">
                ⚠️ Complications & Risk
              </option>
              <option value="imaging-dx" className="bg-white text-slate-900 font-bold">
                🧠 Imaging Dx
              </option>
              <option value="rehab-rtp" className="bg-white text-slate-900 font-bold">
                🏃 Rehab / RTP
              </option>
              <option value="evidence-brief" className="bg-white text-slate-900 font-bold">
                📌 Evidence Brief
              </option>
            </select>

            {/* Case Context Selector */}
            <div className="rounded-2xl border-2 border-slate-900/30 bg-white/60 overflow-hidden">
              <button
                onClick={() => setCasesExpanded(!casesExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-900 hover:bg-white/70 cursor-pointer transition-all"
                title="Select a patient case to provide context"
              >
                <span className="flex items-center gap-2">
                  📋 {settings.selectedCaseId ? 'Case Active' : 'Patient Case'}
                </span>
                <span className="text-lg">{casesExpanded ? '▼' : '▶'}</span>
              </button>

              {casesExpanded && (
                <div className="px-3 pb-3 border-t border-slate-900/20 pt-2 space-y-2">
                  {casesLoading ? (
                    <div className="text-xs text-slate-600 text-center py-2">Loading cases...</div>
                  ) : cases.length === 0 ? (
                    <div className="text-xs text-slate-500 text-center py-2">
                      No cases yet.{' '}
                      <Link href="/cases" className="text-teal hover:underline">
                        Create one
                      </Link>
                    </div>
                  ) : (
                    <>
                      <select
                        value={settings.selectedCaseId || ''}
                        onChange={(e) =>
                          updateSetting('selectedCaseId', e.target.value || null)
                        }
                        className="w-full px-2 py-1.5 rounded-lg text-xs font-medium border-2 border-slate-900/40 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal/60 cursor-pointer"
                      >
                        <option value="">No case selected</option>
                        {cases.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.status === 'active' ? '🟢' : '⚪'} {c.title}
                          </option>
                        ))}
                      </select>
                      {settings.selectedCaseId && (
                        <div className="flex gap-2">
                          <Link
                            href={`/cases/${settings.selectedCaseId}`}
                            className="flex-1 px-2 py-1.5 rounded-lg text-xs font-bold text-center bg-linear-to-r from-cyan-light/80 to-teal/80 text-slate-900 border border-slate-900/50 hover:from-cyan-light hover:to-teal transition-all shadow-sm hover:shadow-md"
                          >
                            View Case
                          </Link>
                          <button
                            onClick={() => updateSetting('selectedCaseId', null)}
                            className="px-2 py-1.5 rounded-lg text-xs font-bold bg-white/80 text-slate-600 border border-slate-900/30 hover:bg-slate-100 transition-all"
                            title="Clear case selection"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  <Link
                    href="/cases"
                    className="block text-center text-xs font-medium text-teal hover:underline"
                  >
                    Manage Cases →
                  </Link>
                </div>
              )}
            </div>

            <Link
              href="/analytics"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border-2 border-slate-900/50 bg-white/70 text-slate-900 hover:bg-white hover:border-slate-900/80 transition-all shadow-sm hover:shadow-md"
              title="Analytics dashboard"
            >
              📊 Analytics
            </Link>

            <button
              onClick={() => updateSetting('enableTools', !settings.enableTools)}
              className={`${toggleStyle} ${
                settings.enableTools
                  ? 'bg-linear-to-r from-yellow/80 to-peach/80 text-slate-900 border-slate-900/70'
                  : 'bg-white/60 text-slate-900 border-slate-900/40 hover:border-slate-900/70'
              }`}
              title="Toggle tools"
            >
              🛠️ Tools {settings.enableTools ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={handleMemoryConsentToggle}
              className={`${toggleStyle} ${
                settings.memoryConsent
                  ? 'bg-linear-to-r from-cyan-light/80 to-teal/80 text-slate-900 border-slate-900/70'
                  : 'bg-white/60 text-slate-900 border-slate-900/40 hover:border-slate-900/70'
              }`}
              title="Allow long-term memory profile usage"
            >
              🧠 Memory {settings.memoryConsent ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => updateSetting('voiceEnabled', !settings.voiceEnabled)}
              className={`${toggleStyle} ${
                settings.voiceEnabled
                  ? 'bg-linear-to-r from-red-500/90 to-pink-500/90 text-white border-slate-900/70'
                  : 'bg-white/60 text-slate-900 border-slate-900/40 hover:border-slate-900/70'
              }`}
              title="Toggle voice"
            >
              🎙️ Voice {settings.voiceEnabled ? 'ON' : 'OFF'}
            </button>

            {/* Profile Section - Expandable */}
            <div className="mt-3 rounded-2xl border-2 border-slate-900/30 bg-white/60 overflow-hidden">
              <button
                onClick={() => setProfileExpanded(!profileExpanded)}
                disabled={!settings.memoryConsent}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-all ${
                  settings.memoryConsent
                    ? 'text-slate-900 hover:bg-white/70 cursor-pointer'
                    : 'text-slate-400 cursor-not-allowed opacity-60'
                }`}
                title={settings.memoryConsent ? 'Manage your profile' : 'Enable Memory to use Profile'}
              >
                <span>👤 Profile</span>
                <span className="text-lg">{profileExpanded ? '▼' : '▶'}</span>
              </button>

              {profileExpanded && settings.memoryConsent && (
                <div className="px-3 pb-3 space-y-2 border-t border-slate-900/20 pt-2">
                  {profileLoading ? (
                    <div className="text-xs text-slate-600 text-center py-2">Loading...</div>
                  ) : (
                    <>
                      <input
                        type="text"
                        placeholder="Clinical Focus (e.g., sports med, foot/ankle)"
                        value={profile.clinicalFocus || ''}
                        onChange={(e) => handleProfileChange('clinicalFocus', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg text-xs border-2 border-slate-900/40 bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal/60 focus:border-teal/60"
                      />
                      <input
                        type="text"
                        placeholder="Research Focus (e.g., tendon healing, imaging)"
                        value={profile.researchFocus || ''}
                        onChange={(e) => handleProfileChange('researchFocus', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg text-xs border-2 border-slate-900/40 bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal/60 focus:border-teal/60"
                      />
                      <input
                        type="text"
                        placeholder="Preferred Evidence (e.g., RCTs, meta-analyses)"
                        value={profile.preferredEvidence || ''}
                        onChange={(e) => handleProfileChange('preferredEvidence', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg text-xs border-2 border-slate-900/40 bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal/60 focus:border-teal/60"
                      />
                      <input
                        type="text"
                        placeholder="Data Sources (e.g., PubMed, PMC, registries)"
                        value={profile.dataSources || ''}
                        onChange={(e) => handleProfileChange('dataSources', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg text-xs border-2 border-slate-900/40 bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal/60 focus:border-teal/60"
                      />
                      <textarea
                        placeholder="Additional notes..."
                        value={profile.notes || ''}
                        onChange={(e) => handleProfileChange('notes', e.target.value)}
                        rows={3}
                        className="w-full px-2 py-1.5 rounded-lg text-xs border-2 border-slate-900/40 bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal/60 focus:border-teal/60 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveProfile}
                          disabled={profileSaving}
                          className="flex-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-linear-to-r from-cyan-light/80 to-teal/80 text-slate-900 border border-slate-900/50 hover:from-cyan-light hover:to-teal transition-all shadow-sm hover:shadow-md disabled:opacity-50"
                        >
                          {profileSaving ? 'Saving...' : '💾 Save'}
                        </button>
                        <button
                          onClick={handleClearProfile}
                          className="px-2 py-1.5 rounded-lg text-xs font-bold bg-white/80 text-red-600 border border-red-600/50 hover:bg-red-50 transition-all shadow-sm hover:shadow-md"
                        >
                          🗑️
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border-2 border-slate-900/30 bg-white/80 px-3 py-2 text-[11px] font-bold text-slate-900">
            💾 Summaries auto-save every 5 messages
          </div>
        </div>
      </aside>

      {/* Mobile: Compact Toolbar Row */}
      <div className="md:hidden flex gap-2 flex-wrap">
        <select
          value={settings.manualMode}
          onChange={(e) =>
            updateSetting(
              'manualMode',
              e.target.value as
                | ''
                | 'clinical-consult'
                | 'treatment-decision'
                | 'surgical-planning'
                | 'complications-risk'
                | 'imaging-dx'
                | 'rehab-rtp'
                | 'evidence-brief'
            )
          }
          className="px-3 py-2 rounded-xl text-xs font-bold bg-white/70 text-slate-900 border-2 border-slate-900/40 shadow-sm"
        >
          <option value="">🤖 Auto</option>
          <option value="clinical-consult">🩺 Clinical Consult</option>
          <option value="treatment-decision">⚖️ Treatment Decision</option>
          <option value="surgical-planning">🧰 Surgical Planning</option>
          <option value="complications-risk">⚠️ Complications & Risk</option>
          <option value="imaging-dx">🧠 Imaging Dx</option>
          <option value="rehab-rtp">🏃 Rehab / RTP</option>
          <option value="evidence-brief">📌 Evidence Brief</option>
        </select>
        <Link
          href="/analytics"
          className="px-3 py-2 rounded-xl text-xs font-bold border-2 border-slate-900/50 bg-white/70 text-slate-900 shadow-sm"
        >
          📊 Analytics
        </Link>
        <button
          onClick={() => updateSetting('enableTools', !settings.enableTools)}
          className={`${toggleStyle} ${
            settings.enableTools
              ? 'bg-linear-to-r from-yellow/80 to-peach/80 text-slate-900 border-slate-900/70'
              : 'bg-white/60 text-slate-900 border-slate-900/40'
          }`}
        >
          🛠️ Tools
        </button>
        <button
          onClick={handleMemoryConsentToggle}
          className={`${toggleStyle} ${
            settings.memoryConsent
              ? 'bg-linear-to-r from-cyan-light/80 to-teal/80 text-slate-900 border-slate-900/70'
              : 'bg-white/60 text-slate-900 border-slate-900/40'
          }`}
        >
          🧠 Memory
        </button>
        <button
          onClick={() => updateSetting('voiceEnabled', !settings.voiceEnabled)}
          className={`${toggleStyle} ${
            settings.voiceEnabled
              ? 'bg-linear-to-r from-red-500/90 to-pink-500/90 text-white border-slate-900/70'
              : 'bg-white/60 text-slate-900 border-slate-900/40'
          }`}
        >
          🎙️ Voice
        </button>
      </div>
    </>
  );
}
