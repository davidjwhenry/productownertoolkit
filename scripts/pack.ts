/**
 * Stage the npm package in `dist-package/`: the built CLI plus every file the catalogue installs,
 * laid out the way `defaultBundleRoot()` expects. Run `npm run package`, then `npm pack ./dist-package`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalogue } from '../cli/src/catalogue/load.ts'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(repoRoot, 'dist-package')
const cliDist = path.join(repoRoot, 'cli/dist')
const SKIP = new Set(['node_modules', 'dist', 'test-results', '.e2e-tmp', '.DS_Store'])

const { catalogue, errors } = loadCatalogue(repoRoot)
if (!catalogue) {
  for (const e of errors) console.error(`✖ ${e}`)
  process.exit(1)
}
if (!fs.existsSync(path.join(repoRoot, 'cli/dist/bin.js'))) {
  console.error('✖ cli/dist is missing; run `npm run build:cli` first (or use `npm run package`)')
  process.exit(1)
}

const runtimeSources: string[] = []
const sources = new Set<string>([
  'cli/dist',
  'toolkit/catalogue.json',
  'toolkit/support',
  'LICENSE',
  ...catalogue.skills.map((s) => `toolkit/skills/${s.name}`),
])
for (const c of catalogue.capabilities) {
  for (const m of [...c.managed, ...c.seed]) sources.add(m.source)
  if (c.runtime) {
    sources.add(c.runtime.source)
    runtimeSources.push(c.runtime.source)
  }
}

fs.rmSync(out, { recursive: true, force: true })
for (const source of sources) {
  const dest = path.join(out, source)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(path.join(repoRoot, source), dest, { recursive: true, filter: (src) => src === cliDist || !SKIP.has(path.basename(src)) })
}

// npm never publishes `.gitignore`; the CLI reads `_gitignore` instead (see catalogue/bundle.ts).
for (const source of runtimeSources) {
  const gitignore = path.join(out, source, '.gitignore')
  if (fs.existsSync(gitignore)) fs.renameSync(gitignore, path.join(out, source, '_gitignore'))
}

const root = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string }
const pkg = {
  name: 'productownertoolkit',
  version: root.version,
  description: 'Install the Product Owner Toolkit (AI skills for PRDs, backlogs, research, prototypes and reporting) into a repository.',
  license: 'MIT',
  type: 'module',
  bin: { productownertoolkit: 'cli/dist/bin.js' },
  engines: { node: '>=22' },
  repository: { type: 'git', url: 'git+https://github.com/davidjwhenry/productownertoolkit.git' },
  keywords: ['product-management', 'ai-agents', 'claude-code', 'codex', 'cursor', 'skills'],
}
fs.writeFileSync(path.join(out, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
fs.writeFileSync(
  path.join(out, 'README.md'),
  `# Product Owner Toolkit

\`\`\`sh
npx productownertoolkit@latest init      # install into the current folder
npx productownertoolkit@latest doctor    # check an installation
\`\`\`

Run \`init --help\` for options. Needs Node.js 22 or later.
`,
)
console.log(`Staged ${pkg.name}@${pkg.version} in dist-package/`)
