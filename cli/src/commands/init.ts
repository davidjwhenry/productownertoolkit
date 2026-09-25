/**
 * `init`: detect, select, preview, confirm, write, and hand off to
 * `bootstrap-context` (IN.1–IN.10, ON.6, ON.8, CP.6, DT.5).
 */
import path from 'node:path'
import type { CliOptions } from '../args.ts'
import type { Bundle } from '../catalogue/bundle.ts'
import { ApplyError, applyPlan } from '../apply.ts'
import { Target, UnsafePathError } from '../fsx.ts'
import { paint, type Io } from '../io.ts'
import { MANIFEST_PATH, parseManifest, type InstallationManifest } from '../manifest.ts'
import { plan as buildPlan, PlanError, type Plan, type PlannedFile } from '../planner.ts'

const PLAYGROUND_NODE = [22, 12] as const

/** Agents whose folders or instruction files are already in the target (IN.4). */
export function detectAgents(target: Target): string[] {
  const has = (rel: string) => target.inspect(rel).kind !== 'missing'
  const detected: string[] = []
  if (['.claude', 'CLAUDE.md', 'CLAUDE.local.md'].some(has)) detected.push('claude-code')
  if (['.cursor', '.cursorrules'].some(has)) detected.push('cursor')
  if (['.codex', '.agents'].some(has)) detected.push('codex')
  return detected
}

function parseList(answer: string): string[] {
  return answer.split(/[\s,]+/).map((item) => item.trim()).filter((item) => item !== '')
}

export function nodeSatisfies(version: string, [major, minor]: readonly [number, number]): boolean {
  const [a = 0, b = 0] = version.split('.').map(Number)
  return a > major || (a === major && b >= minor)
}

export async function runInit(options: CliOptions, io: Io, bundle: Bundle): Promise<number> {
  const { catalogue } = bundle
  let target: Target
  try {
    target = Target.open(path.resolve(io.cwd, options.target ?? '.'))
  } catch (error) {
    if (!(error instanceof UnsafePathError)) throw error
    io.err(error.message)
    return 1
  }

  let existing: InstallationManifest | undefined
  const manifestEntry = target.inspect(MANIFEST_PATH)
  if (manifestEntry.kind === 'file') {
    const read = parseManifest(target.readText(MANIFEST_PATH)!)
    if (read.kind !== 'valid') {
      io.err(read.message)
      io.err('Nothing was written. Run npx productownertoolkit@latest doctor for details.')
      return 1
    }
    existing = read.manifest
  }

  const label = (id: string) => catalogue.agents.find((a) => a.id === id)?.label ?? catalogue.capabilities.find((c) => c.id === id)?.label ?? id
  const ask = options.yes ? undefined : io.interactive ? io.ask : undefined

  // Agents: flags, then the existing installation, then detection and a prompt.
  let agents = options.agents
  if (!agents) {
    const detected = detectAgents(target).filter((id) => !existing?.agents.includes(id))
    if (ask) {
      io.out(`Agents: ${catalogue.agents.map((a) => `${a.id} (${a.label})`).join(', ')}`)
      if (existing) io.out(`Already installed for: ${existing.agents.map(label).join(', ')}`)
      const suggestion = existing ? '' : detected.join(',')
      const answer = await ask(existing ? 'Add agents (comma-separated, Enter for none): ' : `Install for which agents? [${suggestion || 'none detected'}] `)
      agents = answer === '' ? (suggestion ? suggestion.split(',') : []) : parseList(answer)
    } else {
      agents = existing ? [] : detected
    }
    if (!existing && agents.length === 0) {
      io.err('No agent was selected or detected. Pass --agents with one or more of: ' + catalogue.agents.map((a) => a.id).join(', '))
      return 1
    }
  }

  let capabilities = options.capabilities
  if (!capabilities) {
    capabilities = []
    if (ask) {
      const optional = catalogue.capabilities.filter((c) => !c.required && !existing?.capabilities.includes(c.id))
      if (optional.length) {
        io.out('Core is always installed. Optional capabilities:')
        for (const c of optional) io.out(`  ${c.id.padEnd(12)} ${c.label}: ${c.description}`)
        capabilities = parseList(await ask('Add which capabilities? (comma-separated, Enter for none) '))
      }
    }
  }

  let contentRoot = options.contentRoot ?? existing?.contentRoot
  if (contentRoot === undefined) {
    const fallback = catalogue.roots.content.installedDefault
    contentRoot = ask ? (await ask(`Folder for your product work? [${fallback}] `)) || fallback : fallback
  }
  contentRoot = contentRoot.replace(/\/+$/, '') || '.'

  let plan: Plan
  try {
    plan = buildPlan(target, bundle, { agents, capabilities, contentRoot, existing, now: new Date().toISOString() })
  } catch (error) {
    if (!(error instanceof PlanError)) throw error
    io.err(error.message)
    io.err('Nothing was written.')
    return 1
  }

  renderPreview(io, target, bundle, plan, options.dryRun)
  if (plan.conflicts.length) {
    io.err('')
    io.err(paint(io, 'red', `Stopped: ${plan.conflicts.length} conflict${plan.conflicts.length === 1 ? '' : 's'}. Nothing was written.`))
    return 1
  }
  const pending = plan.files.some((f) => f.action !== 'keep') || plan.agentsMd.kind !== 'unchanged' || plan.claude.kind === 'import' || plan.mode === 'install'
  if (!pending) {
    io.out('')
    io.out('Nothing to add: the installation already includes this selection.')
    return 0
  }
  if (options.dryRun) {
    io.out('')
    io.out('Dry run: nothing was written.')
    return 0
  }

  let claudeImport = plan.claude.kind === 'import'
  if (plan.claude.kind === 'import' && ask) {
    const answer = (await ask(`Add the import line to ${plan.claude.path}? [Y/n] `)).toLowerCase()
    claudeImport = answer === '' || answer === 'y' || answer === 'yes'
  }
  if (!options.yes) {
    if (!ask) {
      io.err('')
      io.err('Confirmation is needed, but this terminal cannot prompt. Rerun with --yes to apply this plan, or --dry-run to only preview it.')
      return 1
    }
    const answer = (await ask(plan.mode === 'install' ? 'Install? [y/N] ' : 'Apply these additions? [y/N] ')).toLowerCase()
    if (answer !== 'y' && answer !== 'yes') {
      io.out('Cancelled. Nothing was written.')
      return 1
    }
  }

  try {
    applyPlan(target.root, plan, { claudeImport })
  } catch (error) {
    if (!(error instanceof ApplyError)) throw error
    io.err(error.message)
    return 1
  }
  renderCompletion(io, bundle, plan, claudeImport)
  return 0
}

function groupKey(plan: Plan, file: PlannedFile): string {
  for (const dir of plan.skillDirectories) {
    if (file.path.startsWith(`${dir}/`)) return `${dir}/`
  }
  if (file.path.startsWith(`${plan.toolkitRoot}/`)) return `${plan.toolkitRoot}/`
  if (plan.manifest.playgroundRoot && file.path.startsWith(`${plan.manifest.playgroundRoot}/`)) return `${plan.manifest.playgroundRoot}/`
  const content = plan.contentRoot === '.' ? '' : `${plan.contentRoot}/`
  if (file.path.startsWith(content)) {
    const rest = file.path.slice(content.length).split('/')
    return rest.length > 1 ? `${content}${rest[0]}/` : content || './'
  }
  return `${path.posix.dirname(file.path)}/`
}

function renderGroups(io: Io, plan: Plan, files: PlannedFile[], full: boolean): void {
  if (full) {
    for (const file of files) io.out(`    ${file.path}`)
    return
  }
  const groups = new Map<string, number>()
  for (const file of files) groups.set(groupKey(plan, file), (groups.get(groupKey(plan, file)) ?? 0) + 1)
  for (const [key, count] of groups) io.out(`    ${key.padEnd(44)} ${count} file${count === 1 ? '' : 's'}`)
}

function renderPreview(io: Io, target: Target, bundle: Bundle, plan: Plan, full: boolean): void {
  const { catalogue } = bundle
  const agentLabel = (id: string) => catalogue.agents.find((a) => a.id === id)?.label ?? id
  const capabilityLabel = (id: string) => catalogue.capabilities.find((c) => c.id === id)?.label ?? id
  const added = (all: string[], fresh: string[], label: (id: string) => string) =>
    all.map((id) => (plan.mode === 'add' && fresh.includes(id) ? `${label(id)} (new)` : label(id))).join(', ')
  const heading = (text: string) => io.out(`\n${paint(io, 'bold', text)}`)

  io.out(paint(io, 'bold', `Product Owner Toolkit ${bundle.version}: ${plan.mode === 'install' ? 'install into' : 'add to the installation in'} ${target.root}`))
  io.out('')
  io.out(`  Agents:        ${added(plan.agents, plan.addedAgents, agentLabel)}`)
  io.out(`  Capabilities:  ${added(plan.capabilities, plan.addedCapabilities, capabilityLabel)}`)
  io.out(`  Content root:  ${plan.contentRoot}/  (your product work)`)
  io.out(`  Skill folders: ${plan.skillDirectories.map((d) => `${d}/`).join(', ')}`)

  const creates = plan.files.filter((f) => f.action === 'create')
  const managed = creates.filter((f) => f.ownership === 'managed')
  const seeds = creates.filter((f) => f.ownership === 'seed')
  if (creates.length || plan.mode === 'install') {
    heading(`Files to create (${creates.length + (plan.mode === 'install' ? 1 : 0)})`)
    if (managed.length || plan.mode === 'install') {
      io.out('  Managed by the toolkit; future updates may replace these:')
      renderGroups(io, plan, managed, full)
      if (plan.mode === 'install') io.out(`    ${MANIFEST_PATH}`)
    }
    if (seeds.length) {
      io.out('  Yours; created once and never changed by the toolkit:')
      renderGroups(io, plan, seeds, full)
    }
  }
  const adopted = plan.files.filter((f) => f.action === 'adopt')
  if (adopted.length) {
    heading(`Existing identical files to adopt (${adopted.length})`)
    io.out('  These already match the toolkit exactly; they are recorded, not rewritten.')
    for (const file of adopted) io.out(`    ${file.path}`)
  }
  const kept = plan.files.filter((f) => f.action === 'keep')
  if (kept.length) {
    heading(`Existing files kept as they are (${kept.length})`)
    io.out('  You already have your own version of these starter files; the toolkit leaves them alone.')
    for (const file of kept) io.out(`    ${file.path}`)
  }

  heading('Instructions')
  const agentsMd = plan.agentsMd
  io.out(`  ${agentsMd.kind === 'conflict' ? 'AGENTS.md: see conflicts' : agentsMd.description.replace(/^./, (c) => c.toUpperCase())}.`)
  if (plan.claude.kind === 'import') io.out(`  Proposed: ${plan.claude.description}. You can decline this.`)
  else if (plan.claude.kind === 'none' && plan.agents.includes('claude-code')) io.out(`  CLAUDE.md: no change (${plan.claude.reason}).`)

  if (plan.capabilities.includes('prototyping') && plan.addedCapabilities.includes('prototyping')) {
    const ok = nodeSatisfies(io.nodeVersion, PLAYGROUND_NODE)
    plan.notes.push(`The prototype playground needs Node.js ${PLAYGROUND_NODE.join('.')} or later; this machine has ${io.nodeVersion}${ok ? '' : ', so upgrade Node.js before setting it up'}. Its dependencies are not installed for you.`)
  }
  if (plan.notes.length) {
    heading('Notes')
    for (const note of plan.notes) io.out(`  - ${note}`)
  }
  if (plan.conflicts.length) {
    heading(paint(io, 'red', `Conflicts (${plan.conflicts.length})`))
    for (const c of plan.conflicts) io.out(`  ${paint(io, 'red', 'CONFLICT')} ${c.message}`)
  }
}

function renderCompletion(io: Io, bundle: Bundle, plan: Plan, claudeImport: boolean): void {
  const { catalogue } = bundle
  io.out('')
  io.out(paint(io, 'green', plan.mode === 'install' ? `Installed Product Owner Toolkit ${bundle.version}.` : 'Added to the Product Owner Toolkit installation.'))
  if (plan.claude.kind === 'import' && !claudeImport) {
    io.out(`${plan.claude.path} was left unchanged, so Claude Code will not see the toolkit map until you add \`@AGENTS.md\` to it. doctor reports this.`)
  }
  if (plan.manifest.configuration.status === 'pending') {
    io.out('')
    io.out(paint(io, 'bold', 'Files are installed, but company configuration is still pending.'))
    io.out('Next, run the bootstrap-context skill to set up your company context:')
    for (const id of plan.agents) {
      const agent = catalogue.agents.find((a) => a.id === id)!
      io.out(`  ${agent.label}: ${agent.invocation.replace('{skill}', 'bootstrap-context')}`)
    }
  }
  if (plan.addedCapabilities.includes('prototyping')) {
    io.out('')
    io.out('Prototyping:')
    io.out(`  The design profile in ${plan.contentRoot}/design-system/ is an example that you now own. Run design-system-setup to use your company's design sources.`)
    io.out(`  To start the playground (Node.js ${PLAYGROUND_NODE.join('.')} or later): cd ${plan.manifest.playgroundRoot} && npm install && npm start`)
  }
  io.out('')
  io.out('Check the installation at any time with: npx productownertoolkit@latest doctor')
}
