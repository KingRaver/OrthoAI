import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ✅ Next.js 16 fixed config
  experimental: {
    optimizePackageImports: ['openai']
  },

  // Prevent Next/Turbopack from trying to bundle Chroma deps that ship TS/MD sources
  serverExternalPackages: [
    'chromadb',
    '@chroma-core/default-embed',
    '@chroma-core/ai-embeddings-common',
    '@huggingface/transformers',
    'onnxruntime-node',
    'sharp'
  ],

  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    minimumCacheTTL: 3600
  },

  async headers() {
    return [
      {
        source: '/api/llm/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'X-Accel-Buffering', value: 'no' }
        ]
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' }
        ]
      }
    ];
  },

  transpilePackages: ['ai', 'openai']
};

export default nextConfig;
