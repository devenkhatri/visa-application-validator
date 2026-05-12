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
};

export default nextConfig;
