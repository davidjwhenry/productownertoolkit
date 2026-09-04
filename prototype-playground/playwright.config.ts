import { defineConfig } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const configDir = dirname(fileURLToPath(import.meta.url))

/**
 * End-to-end tests run against a process-owned temporary fixture repository
 * rather than the checked-in tree, so failure-case fixtures never touch
 * `requirements/` or `examples/`. `scripts/e2e-fixture.ts` builds the fixture
 * before the dev server starts; the server resolves it exclusively through
 * the trusted-process-only `PROTOTYPE_PLAYGROUND_ROOT` environment variable.
 */
const fixtureRoot = join(configDir, '.e2e-tmp', 'fixture-repo')

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'off',
  },
  webServer: {
    command: 'tsx scripts/e2e-fixture.ts && npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      PROTOTYPE_PLAYGROUND_ROOT: fixtureRoot,
    },
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
