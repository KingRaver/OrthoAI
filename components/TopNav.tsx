// components/TopNav.tsx
'use client';
import Link from 'next/link';

interface TopNavProps {
  // State values
  messageCount: number;
}

export default function TopNav({
  messageCount,
}: TopNavProps) {
  return (
    <nav className="sticky top-0 z-50 w-full shrink-0">
      {/* Main Navigation Container with Vibrant Gradient */}
      <div className="w-full bg-linear-to-r from-cyan-light via-teal to-peach shadow-2xl border-b-4 border-black/20"
      >
        <div className="max-w-full mx-auto px-8 py-5">
          {/* Top Row: Branding + Controls */}
          <div className="flex items-center justify-between gap-8">
            {/* Left: Branding - Clickable Logo to Analytics Dashboard */}
            <Link href="/analytics" className="flex flex-col min-w-max group cursor-pointer">
              <h1 className="text-2xl font-black text-slate-900 drop-shadow-sm tracking-tight group-hover:text-slate-700 transition-colors">
                🦴 OrthoAI
              </h1>
              <p className="text-slate-800 text-xs font-bold tracking-widest uppercase group-hover:text-slate-700 transition-colors">
                Orthopedic Assistant
              </p>
            </Link>

            {/* Center Divider */}
            <div className="h-12 w-1 bg-slate-900/30 rounded-full" />

            {/* Right: Control Groups */}
            <div className="flex gap-6 items-center flex-1">
              {/* Right Info: Status */}
              <div className="ml-auto flex flex-col items-end text-slate-800 text-xs font-bold whitespace-nowrap">
                <span>📊 {messageCount} messages</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
