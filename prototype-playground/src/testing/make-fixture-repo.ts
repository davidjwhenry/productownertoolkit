/**
 * Temporary fixture-repository builder for catalogue/profile/paths tests.
 * Every fixture lives under a process-owned `mkdtemp` directory and is
 * removed by the returned cleanup function.
 */
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const VERSION_DIR = 'design-system/profiles/v001'

export type FixtureRepo = {
  root: string
  cleanup: () => Promise<void>
  write: (relPath: string, content: string | Buffer) => Promise<void>
  remove: (relPath: string) => Promise<void>
  link: (relPath: string, target: string) => Promise<void>
  refreshActive: () => Promise<string>
  profileFingerprint: string
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

export function validEntryHtml(scenarios: string[] = ['happy-path']): string {
  const scenarioAttr = scenarios[0] ? `\n      <p data-prototype-scenario="${scenarios[0]}" hidden>Scenario content</p>` : ''
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fixture entry</title>
  <style>body { color: #111; }</style>
</head>
<body data-prototype-start="home">
  <main>
    <section data-prototype-screen="home" id="home">
      <h1>Home</h1>
      <form id="amount-form">
        <label for="amount">Amount</label>
        <input type="text" id="amount" name="amount" maxlength="32" required>
        <p data-prototype-validation-for="amount" id="amount-error" aria-live="polite"></p>
      </form>
      <button type="button" data-prototype-go="done" data-prototype-validate="amount-form" data-prototype-error="Enter an amount">Continue</button>
      <button type="button" data-prototype-toggle="detail-region">Details</button>
      <div id="detail-region" hidden><p>Detail region</p></div>${scenarioAttr}
    </section>
    <section data-prototype-screen="done" id="done">
      <h2>Done</h2>
      <p data-prototype-bind="amount">Amount</p>
      <button type="button" data-prototype-go-by-scenario="happy-path:home,*:home" data-prototype-validate="amount-form" data-prototype-error="Enter an amount">Again</button>
      <button type="button" data-prototype-back>Back</button>
      <button type="button" data-prototype-reset>Reset</button>
    </section>
  </main>
</body>
</html>
`
}

export function validManifest(fingerprint: string, options: { id?: string; feature?: string } = {}): Record<string, unknown> {
  const id = options.id ?? 'demo'
  const feature = options.feature ?? 'demo-feature'
  return {
    schemaVersion: 1,
    id,
    title: 'Demo prototype',
    summary: 'Fixture prototype for tests',
    revision: 1,
    source: { prd: `examples/${feature}/prd/${feature}-prd.md`, requirementIds: ['AF.1'] },
    designSystem: { id: 'default', version: 'v001', fingerprint },
    brief: { primaryUser: 'Retail customer', job: 'Save automatically', journey: 'Setup', decision: 'Speed versus trust' },
    variants: [
      { id: 'focused', label: 'Focused', hypothesis: 'Controls up front', tradeOffs: ['Less context'], entry: `examples/${feature}/prototypes/${id}/variants/focused.html` },
    ],
    surfaces: ['desktop', 'ios'],
    scenarios: [
      { id: 'happy-path', label: 'Happy path', description: 'Everything works', requirementIds: ['AF.1'] },
    ],
    defaults: { variant: 'focused', surface: 'desktop', scenario: 'happy-path', theme: 'light' },
    prototypeOnly: ['Fixture data only'],
  }
}

async function computeFingerprint(root: string): Promise<string> {
  const files: string[] = []
  const walk = async (rel: string): Promise<void> => {
    for (const entry of await readdir(path.join(root, rel), { withFileTypes: true })) {
      const child = `${rel}/${entry.name}`
      if (entry.isDirectory()) await walk(child)
      else files.push(child)
    }
  }
  await walk(VERSION_DIR)
  files.sort()
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(file.slice(VERSION_DIR.length + 1))
    hash.update('\0')
    hash.update(await readFile(path.join(root, file)))
    hash.update('\0')
  }
  return `sha256:${hash.digest('hex')}`
}

export async function makeFixtureRepo(): Promise<FixtureRepo> {
  const root = await mkdtemp(path.join(tmpdir(), 'prototype-playground-test-'))
  const write = async (relPath: string, content: string | Buffer): Promise<void> => {
    const abs = path.join(root, relPath)
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
  const remove = async (relPath: string): Promise<void> => {
    await rm(path.join(root, relPath), { force: true })
  }
  const link = async (relPath: string, target: string): Promise<void> => {
    const abs = path.join(root, relPath)
    await mkdir(path.dirname(abs), { recursive: true })
    await symlink(target, abs)
  }
  const refreshActive = async (): Promise<string> => {
    const fingerprint = await computeFingerprint(root)
    await write('design-system/profiles/ACTIVE', `v001\n${fingerprint}\n`)
    return fingerprint
  }

  // Raw design source.
  const penBytes = Buffer.from('fixture pen bytes')
  const penSha = createHash('sha256').update(penBytes).digest('hex')
  await write('design-system/example.pen', penBytes)

  // Immutable profile version.
  await write(
    `${VERSION_DIR}/profile.json`,
    JSON.stringify(
      {
        schemaVersion: 1,
        id: 'default',
        version: 'v001',
        name: 'Default',
        sources: [{ id: 'example-pen', kind: 'pen', roles: ['tokens', 'components'], required: true, path: 'design-system/example.pen', sha256: penSha }],
        themes: [
          { id: 'light', label: 'Light' },
          { id: 'dark', label: 'Dark' },
        ],
        defaultTheme: 'light',
        runtimeCss: 'tokens.css',
        componentCatalogue: 'components.json',
        assetCatalogue: 'assets.json',
      },
      null,
      2,
    ),
  )
  await write(`${VERSION_DIR}/tokens.css`, ':root { --background: #fff; }\n')
  await write(
    `${VERSION_DIR}/components.json`,
    JSON.stringify({ schemaVersion: 1, components: [{ id: 'button', name: 'Button', variants: ['Default'], sourceIds: ['example-pen'] }] }),
  )
  await write(`${VERSION_DIR}/assets.json`, JSON.stringify({ schemaVersion: 1, assets: [] }))

  const fingerprint = await refreshActive()

  // One valid example prototype.
  await write('examples/demo-feature/prd/demo-feature-prd.md', '# Demo PRD\n\n## 5.1. Demo Requirement\n\nAF.1 The app shall demo.\n')
  await write('examples/demo-feature/prototypes/demo/variants/focused.html', validEntryHtml())
  await write('examples/demo-feature/prototypes/demo/prototype.json', JSON.stringify(validManifest(fingerprint), null, 2))

  return { root, write, remove, link, refreshActive, profileFingerprint: fingerprint, cleanup: async () => {
    if (await exists(root)) await rm(root, { recursive: true, force: true })
  } }
}
