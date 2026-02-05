import Chat from '@/components/Chat';

export default function Home() {
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-50">
      {/* 
        Chat component now manages:
        - TopNav (sticky, fixed positioning with vibrant gradient)
        - Messages area with professional light background
        - Input area (voice or text)
        - Footer with status info
        
        This page.tsx provides the global light professional background gradient
        and container context only.
      */}
      <Chat />
    </div>
  );
}
