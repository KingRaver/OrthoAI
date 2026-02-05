import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

// Font Configuration
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Viewport Configuration
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true
};

// Metadata Configuration - OrthoAI
export const metadata: Metadata = {
  title: '🦴 OrthoAI | Orthopedic Research Intelligence',
  description: 'Local-first orthopedic research intelligence for clinicians and researchers. Evidence synthesis, mechanistic reasoning, hypothesis generation, and study design with citations and feedback-driven learning.',
  keywords: [
    'Orthopedics',
    'Orthopedic Research',
    'Medical Discovery',
    'Biomechanics',
    'Tendon',
    'Ligament',
    'Cartilage',
    'Surgery',
    'Imaging',
    'Rehabilitation',
    'Local AI',
    'RAG',
    'llama.cpp'
  ],
  authors: [
    {
      name: 'OrthoAI',
      url: 'https://orthoai.local'
    }
  ],
  creator: 'OrthoAI Team',
  publisher: 'OrthoAI',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://orthoai.local',
    siteName: 'OrthoAI',
    title: '🦴 OrthoAI | Orthopedic Research Intelligence',
    description: 'Local-first orthopedic research intelligence with evidence synthesis, mechanistic reasoning, and discovery workflows.'
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent'
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico'
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect for font optimization */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Smooth scroll behavior */}
        <style>{`
          html {
            scroll-behavior: smooth;
          }
        `}</style>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-x-hidden overflow-y-auto bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-50`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
