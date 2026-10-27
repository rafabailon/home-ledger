import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          reports: ['jspdf'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/{backup,finance,format,reports,database}.ts'],
      thresholds: { lines: 85, functions: 85, branches: 75, statements: 85 },
    },
  },
})