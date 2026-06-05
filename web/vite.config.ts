// Configure Vite with React + the "@" alias for ShadCN-style imports
// Import defineConfig from vitest/config so the `test` field is typed
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** Vite + Vitest config, wiring the @ alias and the node test environment for pure-logic tests */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Map "@" to src so imports match ShadCN conventions
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    // Use the node environment because only pure logic is tested (no DOM)
    environment: 'node',
  },
});
