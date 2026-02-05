// components/LeftToolbar.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

type StrategyType = 'balanced' | 'speed' | 'quality' | 'cost' | 'adaptive' | 'workflow';
type WorkflowMode = 'auto' | 'chain' | 'ensemble';

interface ModelOption {
  id: string;
  name: string;
  speed: string;
}

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
    | 'surgical-planning'
    | 'complications-risk'
    | 'imaging-dx'
    | 'rehab-rtp'
    | 'evidence-brief';
  selectedStrategy: StrategyType;
  workflowMode: WorkflowMode;
  model: string;
  enableTools: boolean;
  voiceEnabled: boolean;
  strategyEnabled: boolean;
  memoryConsent: boolean;
}

interface LeftToolbarProps {
  models: ModelOption[];
  autoSelectedModel: string;
  onSettingsChange: (settings: ToolbarSettings) => void;
}

export default function LeftToolbar({
  models,
  autoSelectedModel,
  onSettingsChange,
}: LeftToolbarProps) {
  // LeftToolbar owns all settings state
  const [settings, setSettings] = useState<ToolbarSettings>({
    manualMode: '',
    selectedStrategy: 'balanced',
    workflowMode: 'auto',
    model: 'biomistral-7b-instruct',
    enableTools: false,
    voiceEnabled: false,
    strategyEnabled: false,
    memoryConsent: false,
  });

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
        .filter(([_, value]) => value && value.trim())
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
        <div className="rounded-3xl border-2 border-slate-900/40 bg-gradient-to-b from-cyan-light/30 via-white/70 to-peach/40 shadow-xl p-4">
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
                    | 'surgical-planning'
                    | 'complications-risk'
                    | 'imaging-dx'
                    | 'rehab-rtp'
                    | 'evidence-brief'
                )
              }
              className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white/70 text-slate-900 border-2 border-slate-900/40 hover:bg-white hover:border-slate-900/70 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-900/60 cursor-pointer shadow-sm hover:shadow-md"
              title="Mode: Auto-detect or select clinical consult, surgical planning, complications/risk, imaging dx, rehab/RTP, or evidence brief"
            >
              <option value="" className="bg-white text-slate-900 font-bold">
                🤖 Auto
              </option>
              <option value="clinical-consult" className="bg-white text-slate-900 font-bold">
                🩺 Clinical Consult
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

            <div className="rounded-2xl border-2 border-slate-900/30 bg-white/60 p-3 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                Model
              </div>
              <select
                value={settings.model}
                onChange={(e) => updateSetting('model', e.target.value)}
                disabled={settings.strategyEnabled}
                className="mt-2 w-full px-3 py-2 rounded-xl text-xs font-bold bg-white/80 text-slate-900 border-2 border-slate-900/40 hover:bg-white hover:border-slate-900/70 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-900/60 cursor-pointer shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                title={
                  settings.strategyEnabled
                    ? 'Model selection disabled when Strategy is enabled'
                    : 'Select the AI model to use'
                }
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id} className="bg-white text-slate-900 font-bold">
                    {m.name} {m.speed}
                  </option>
                ))}
              </select>
              {settings.strategyEnabled && autoSelectedModel && (
                <div
                  className="mt-2 text-[11px] font-bold text-slate-800 bg-white/70 px-2.5 py-1.5 rounded-lg border border-slate-900/30 text-center"
                  title="Model automatically selected by strategy"
                >
                  🤖 {autoSelectedModel}
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
              onClick={() => updateSetting('strategyEnabled', !settings.strategyEnabled)}
              className={`${toggleStyle} ${
                settings.strategyEnabled
                  ? 'bg-gradient-to-r from-yellow/80 to-peach/80 text-slate-900 border-slate-900/70'
                  : 'bg-white/60 text-slate-900 border-slate-900/40 hover:border-slate-900/70'
              }`}
              title="Toggle adaptive strategy"
            >
              ⚡ Strategy {settings.strategyEnabled ? 'ON' : 'OFF'}
            </button>

            {settings.strategyEnabled && (
              <>
                <select
                  value={settings.selectedStrategy}
                  onChange={(e) => updateSetting('selectedStrategy', e.target.value as StrategyType)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white/70 text-slate-900 border-2 border-slate-900/40 hover:bg-white hover:border-slate-900/70 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-slate-900/60 cursor-pointer shadow-sm hover:shadow-md"
                  title="Select optimization strategy"
                >
                  <option value="balanced" className="bg-white text-slate-900 font-bold">
                    ⚖️ Balanced
                  </option>
                  <option value="speed" className="bg-white text-slate-900 font-bold">
                    🚀 Speed
                  </option>
                  <option value="quality" className="bg-white text-slate-900 font-bold">
                    🧠 Quality
                  </option>
                  <option value="cost" className="bg-white text-slate-900 font-bold">
                    💰 Cost
                  </option>
                  <option value="adaptive" className="bg-white text-slate-900 font-bold">
                    🤖 Adaptive ML
                  </option>
                  <option value="workflow" className="bg-white text-slate-900 font-bold">
                    🔗 Workflow
                  </option>
                </select>

                {settings.selectedStrategy === 'workflow' && (
                  <select
                    value={settings.workflowMode}
                    onChange={(e) => updateSetting('workflowMode', e.target.value as WorkflowMode)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-white/70 text-slate-900 border-2 border-purple-600/40 hover:bg-white hover:border-purple-600/70 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-600/50 cursor-pointer shadow-sm hover:shadow-md"
                    title="Select workflow mode"
                  >
                    <option value="auto" className="bg-white text-slate-900 font-bold">
                      🎯 Auto
                    </option>
                    <option value="chain" className="bg-white text-slate-900 font-bold">
                      ⛓️ Chain (3B→7B→16B)
                    </option>
                    <option value="ensemble" className="bg-white text-slate-900 font-bold">
                      🗳️ Ensemble (Voting)
                    </option>
                  </select>
                )}
              </>
            )}

            <button
              onClick={() => updateSetting('enableTools', !settings.enableTools)}
              className={`${toggleStyle} ${
                settings.enableTools
                  ? 'bg-gradient-to-r from-yellow/80 to-peach/80 text-slate-900 border-slate-900/70'
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
                  ? 'bg-gradient-to-r from-cyan-light/80 to-teal/80 text-slate-900 border-slate-900/70'
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
                  ? 'bg-gradient-to-r from-red-500/90 to-pink-500/90 text-white border-slate-900/70'
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
                          className="flex-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-cyan-light/80 to-teal/80 text-slate-900 border border-slate-900/50 hover:from-cyan-light hover:to-teal transition-all shadow-sm hover:shadow-md disabled:opacity-50"
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
          <option value="surgical-planning">🧰 Surgical Planning</option>
          <option value="complications-risk">⚠️ Complications & Risk</option>
          <option value="imaging-dx">🧠 Imaging Dx</option>
          <option value="rehab-rtp">🏃 Rehab / RTP</option>
          <option value="evidence-brief">📌 Evidence Brief</option>
        </select>
        <select
          value={settings.model}
          onChange={(e) => updateSetting('model', e.target.value)}
          disabled={settings.strategyEnabled}
          className="px-3 py-2 rounded-xl text-xs font-bold bg-white/70 text-slate-900 border-2 border-slate-900/40 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <Link
          href="/analytics"
          className="px-3 py-2 rounded-xl text-xs font-bold border-2 border-slate-900/50 bg-white/70 text-slate-900 shadow-sm"
        >
          📊 Analytics
        </Link>
        <button
          onClick={() => updateSetting('strategyEnabled', !settings.strategyEnabled)}
          className={`${toggleStyle} ${
            settings.strategyEnabled
              ? 'bg-gradient-to-r from-yellow/80 to-peach/80 text-slate-900 border-slate-900/70'
              : 'bg-white/60 text-slate-900 border-slate-900/40'
          }`}
        >
          ⚡ Strategy
        </button>
        {settings.strategyEnabled && (
          <>
            <select
              value={settings.selectedStrategy}
              onChange={(e) => updateSetting('selectedStrategy', e.target.value as StrategyType)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-white/70 text-slate-900 border-2 border-slate-900/40 shadow-sm"
            >
              <option value="balanced">⚖️ Balanced</option>
              <option value="speed">🚀 Speed</option>
              <option value="quality">🧠 Quality</option>
              <option value="cost">💰 Cost</option>
              <option value="adaptive">🤖 Adaptive ML</option>
              <option value="workflow">🔗 Workflow</option>
            </select>
            {settings.selectedStrategy === 'workflow' && (
              <select
                value={settings.workflowMode}
                onChange={(e) => updateSetting('workflowMode', e.target.value as WorkflowMode)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-white/70 text-slate-900 border-2 border-purple-600/40 shadow-sm"
              >
                <option value="auto">🎯 Auto</option>
                <option value="chain">⛓️ Chain</option>
                <option value="ensemble">🗳️ Ensemble</option>
              </select>
            )}
          </>
        )}
        <button
          onClick={() => updateSetting('enableTools', !settings.enableTools)}
          className={`${toggleStyle} ${
            settings.enableTools
              ? 'bg-gradient-to-r from-yellow/80 to-peach/80 text-slate-900 border-slate-900/70'
              : 'bg-white/60 text-slate-900 border-slate-900/40'
          }`}
        >
          🛠️ Tools
        </button>
        <button
          onClick={handleMemoryConsentToggle}
          className={`${toggleStyle} ${
            settings.memoryConsent
              ? 'bg-gradient-to-r from-cyan-light/80 to-teal/80 text-slate-900 border-slate-900/70'
              : 'bg-white/60 text-slate-900 border-slate-900/40'
          }`}
        >
          🧠 Memory
        </button>
        <button
          onClick={() => updateSetting('voiceEnabled', !settings.voiceEnabled)}
          className={`${toggleStyle} ${
            settings.voiceEnabled
              ? 'bg-gradient-to-r from-red-500/90 to-pink-500/90 text-white border-slate-900/70'
              : 'bg-white/60 text-slate-900 border-slate-900/40'
          }`}
        >
          🎙️ Voice
        </button>
      </div>
    </>
  );
}
