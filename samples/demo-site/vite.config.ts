import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath, URL } from 'node:url';

// `npm run dev` serves the page; the API runs separately (`cd api && func start`, port 7071) and
// is proxied, as Static Web Apps does when deployed. The code panels import the samples in
// ../javascript, so the dev server may read one level up.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: true,
    proxy: { '/api': 'http://localhost:7071' },
    fs: { allow: ['..'] },
  },
  // The API's own tests run with node --test (cd api && npm test)
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
