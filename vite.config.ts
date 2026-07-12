import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Use API key from environment variables (Vercel provides these at build time)
    const geminiApiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
    
    return {
      server: {
        port: 3002,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          // Dev-only: macOS's case-insensitive filesystem makes Vite match the
          // request path /app to App.tsx and serve the raw module. Rewrite it
          // to index.html so the SPA router handles it, same as the
          // vercel.json rewrite does in production.
          name: 'spa-app-route-rewrite',
          apply: 'serve' as const,
          configureServer(server) {
            server.middlewares.use((req, _res, next) => {
              if (req.url === '/app' || req.url?.startsWith('/app?')) {
                req.url = '/index.html';
              }
              next();
            });
          },
        },
      ],
      define: {
        // Expose API key for client-side usage
        'process.env.API_KEY': JSON.stringify(geminiApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
        'process.env.NODE_ENV': JSON.stringify(mode)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
