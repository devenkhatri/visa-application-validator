import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Increase max body size for file uploads (10 MB per file + multipart overhead)
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
  // Packages that must run on the server only (native bindings)
  serverExternalPackages: [
    'better-sqlite3',
    'canvas',
    'pdfjs-dist',
    '@react-pdf/renderer',
  ],
  // Expose OCR_MODE to client components (ProcessingSteps.tsx)
  env: {
    NEXT_PUBLIC_OCR_MODE: process.env.OCR_MODE ?? 'openrouter',
  },
};

export default nextConfig;
