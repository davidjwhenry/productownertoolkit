/**
 * Generate the agent skill mirrors and the managed AGENTS.md block from `toolkit/`.
 *
 *   node scripts/generate.ts           write generated files
 *   node scripts/generate.ts --check   fail if generated files are out of date or the catalogue is invalid
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { allSkillDirectories, skillDirectoriesFor } from '../cli/src/catalogue/agents.ts'
import { renderAgentsBlock, replaceManagedBlock } from '../cli/src/catalogue/agents-block.ts'
import { loadCatalogue, SKILLS_PATH } from '../cli/src/catalogue/load.ts'
import { lintTokens, renderTokens, STANDALONE_ROOTS } from '../cli/src/catalogue/tokens.ts'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')
const AGENTS_BLOCK_TEMPLATE = 'toolkit/support/agents-block.md'
const IGNORED = new Set(['.DS_Store'])

function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && !IGNORED.has(d.name))
    .map((d) => path.relative(dir, path.join(d.parentPath, d.name)).split(path.sep).join('/'))
    .sort()
}

function isBinary(buffer: Buffer): boolean {
  return buffer.includes(0)
}

function renderFile(buffer: Buffer): Buffer {
  if (isBinary(buffer)) return buffer
  return Buffer.from(renderTokens(buffer.toString('utf8').replace(/\r\n/g, '\n'), STANDALONE_ROOTS))
}

const problems: string[] = []

const { catalogue, errors } = loadCatalogue(repoRoot)
problems.push(...errors)
if (!catalogue) {
  for (const p of problems) console.error(`✖ ${p}`)
  process.exit(1)
}

// Canonical skills and the block template must use path tokens, never root-level paths.
const skillsRoot = path.join(repoRoot, SKILLS_PATH)
const canonical = listFiles(skillsRoot)
for (const rel of [...canonical.map((f) => `${SKILLS_PATH}/${f}`), AGENTS_BLOCK_TEMPLATE]) {
  const buffer = fs.readFileSync(path.join(repoRoot, rel))
  if (isBinary(buffer)) continue
  const text = buffer.toString('utf8')
  for (const finding of lintTokens(text)) problems.push(`${rel}:${finding.line} ${finding.message}`)
  // Relative markdown links inside a skill must resolve to a file shipped with it.
  if (rel.startsWith(SKILLS_PATH) && rel.endsWith('.md')) {
    const prose = text.replace(/^```[\s\S]*?^```/gm, '')
    for (const [, target] of prose.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:/i.test(target)) continue
      if (!fs.existsSync(path.join(repoRoot, path.dirname(rel), target))) problems.push(`${rel} links to missing file ${target}`)
    }
  }
}

// Expected generated files: repo-relative path → contents.
// This repository supports every agent, so it carries the minimal folder set for all of them.
const mirrors = skillDirectoriesFor(catalogue, catalogue.agents.map((a) => a.id))
const expected = new Map<string, Buffer>()
for (const dir of mirrors) {
  for (const rel of canonical) {
    expected.set(`${dir}/${rel}`, renderFile(fs.readFileSync(path.join(skillsRoot, rel))))
  }
}
const agentsPath = path.join(repoRoot, 'AGENTS.md')
try {
  const block = renderAgentsBlock(fs.readFileSync(path.join(repoRoot, AGENTS_BLOCK_TEMPLATE), 'utf8'), catalogue, {
    capabilities: catalogue.capabilities.map((c) => c.id),
    agents: catalogue.agents.map((a) => a.id),
    roots: STANDALONE_ROOTS,
  })
  expected.set('AGENTS.md', Buffer.from(replaceManagedBlock(fs.readFileSync(agentsPath, 'utf8'), block)))
} catch (error) {
  problems.push(`AGENTS.md: ${(error as Error).message}`)
}

if (problems.length) {
  for (const p of problems) console.error(`✖ ${p}`)
  process.exit(1)
}

// Compare with, or write to, the working tree. Generated mirror directories are owned outright.
const drift: string[] = []
// Any skill folder an agent reads is owned by the generator; files outside the mirror set are stale.
const ownedDirectories = allSkillDirectories(catalogue)
const unexpected = ownedDirectories.flatMap((dir) =>
  listFiles(path.join(repoRoot, dir))
    .map((rel) => `${dir}/${rel}`)
    .filter((rel) => !expected.has(rel)),
)
for (const [rel, contents] of expected) {
  const target = path.join(repoRoot, rel)
  const current = fs.existsSync(target) ? fs.readFileSync(target) : undefined
  if (current?.equals(contents)) continue
  drift.push(`${current ? 'changed' : 'missing'}: ${rel}`)
  if (!check) {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, contents)
  }
}
for (const rel of unexpected) {
  drift.push(`unexpected: ${rel}`)
  if (!check) fs.rmSync(path.join(repoRoot, rel))
}
if (!check) {
  for (const dir of ownedDirectories) {
    const root = path.join(repoRoot, dir)
    if (!fs.existsSync(root)) continue
    const dirs = fs.readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(d.parentPath, d.name))
      .sort((a, b) => b.length - a.length)
    for (const empty of [...dirs, root]) if (fs.readdirSync(empty).every((f) => IGNORED.has(f))) fs.rmSync(empty, { recursive: true })
  }
}

if (check && drift.length) {
  for (const d of drift) console.error(`✖ ${d}`)
  console.error('Generated files are out of date. Run `npm run generate` and commit the result.')
  process.exit(1)
}
console.log(check ? '✔ Generated files are up to date.' : `✔ Generated ${drift.length} file change(s).`)
