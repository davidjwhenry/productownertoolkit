/**
 * Catalogue-mode Vite configuration. The server binds to `127.0.0.1`
 * only, disables CORS, restricts hosts, and keeps `server.fs.strict`
 * with an allow-list of exactly the real app root; the trusted Node
 * plugin reads already-authorised repository files outside it. Build
 * emits no source maps and no external `sourcesContent`. Watch coverage
 * of repository prototype/design-profile files is added by the registry
 * plugin at dev-server start.
 */
import { realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import prototypeRegistryPlugin from './src/registry/vite-plugin'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)))

export default defineConfig({
  plugins: [react(), prototypeRegistryPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    cors: false,
    allowedHosts: ['127.0.0.1', 'localhost'],
    fs: {
      strict: true,
      allow: [realpathSync(appRoot)],
    },
  },
  build: {
    sourcemap: false,
    outDir: 'dist',
    emptyOutDir: true,
  },
})
