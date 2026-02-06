'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CaseList from '@/components/CaseList';
import CaseForm from '@/components/CaseForm';
import type { PatientCase } from '@/app/lib/cases/types';

export default function CasesPage() {
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedCase, setSelectedCase] = useState<PatientCase | null>(null);

  const handleSelectCase = (patientCase: PatientCase) => {
    router.push(`/cases/${patientCase.id}`);
  };

  const handleCaseSaved = (patientCase: PatientCase) => {
    setShowCreateForm(false);
    setSelectedCase(null);
    router.push(`/cases/${patientCase.id}`);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-cyan-50/30 to-slate-50">
      {/* Header */}
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
          <div className="text-sm font-semibold text-slate-700">Patient Cases</div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">
        {showCreateForm ? (
          <div className="max-w-2xl mx-auto">
            <CaseForm
              onSave={handleCaseSaved}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        ) : (
          <div className="bg-white/90 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <CaseList
              onSelectCase={handleSelectCase}
              onCreateNew={() => setShowCreateForm(true)}
              selectedCaseId={selectedCase?.id}
            />
          </div>
        )}
      </div>
    </div>
  );
}
