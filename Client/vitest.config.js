import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/test/**',
        'src/__tests__/**',
        'src/main.jsx',
        'src/App.jsx',
        'src/api/**',
        'src/img/**',
        'src/styles/**'
      ],
      thresholds: {
        lines: 75, branches: 75, functions: 75, statements: 75,
        'src/pages/**': { lines: 80, branches: 80, functions: 80, statements: 80 },
        'src/components/**': { lines: 80, branches: 80, functions: 80, statements: 80 }
      }
    }
  }
});