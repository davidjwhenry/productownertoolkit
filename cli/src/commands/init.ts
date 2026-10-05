/**
 * `init`: detect, select, preview, confirm, write, and hand off to
 * `bootstrap-context` (IN.1–IN.10, ON.6, ON.8, CP.6, DT.5).
 */
import fs from 'node:fs'
import path from 'node:path'
import type { CliOptions } from '../args.ts'
import type { Bundle } from '../catalogue/bundle.ts'
import { ApplyError, applyPlan } from '../apply.ts'
import { banner, card, stepper } from '../brand.ts'
import { Target, UnsafePathError } from '../fsx.ts'
import { paint, type Io } from '../io.ts'
import { MANIFEST_PATH, parseManifest, type InstallationManifest } from '../manifest.ts'
import { plan as buildPlan, PlanError, type Plan, type PlannedFile } from '../planner.ts'

const PLAYGROUND_NODE = [22, 12] as const
const REPOSITORY_URL = 'https://github.com/davidjwhenry/productownertoolkit'

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

  // Prompted runs get the banner and numbered steps; scripted runs stay plain.
  const optional = catalogue.capabilities.filter((c) => !c.required && !existing?.capabilities.includes(c.id))
  const steps = [
    !options.agents && 'Agents',
    !options.capabilities && optional.length > 0 && 'Capabilities',
    (options.contentRoot ?? existing?.contentRoot) === undefined && 'Folder',
    'Review',
  ].filter((title) => title !== false)
  const step = (title: string) => {
    if (!ask) return
    io.out('')
    io.out(stepper(io, steps, steps.indexOf(title)))
    io.out('')
  }
  if (ask) for (const line of banner(io, bundle.version)) io.out(line)

  // Agents: flags, then the existing installation, then detection and a prompt.
  let agents = options.agents
  if (!agents) {
    const detected = detectAgents(target).filter((id) => !existing?.agents.includes(id))
    if (ask) {
      step('Agents')
      if (existing) io.out(`Already installed for: ${existing.agents.map(label).join(', ')}`)
      const choices = catalogue.agents.filter((a) => !existing?.agents.includes(a.id)).map((a) => ({ id: a.id, label: a.label }))
      agents = await io.select(existing ? 'Add agents' : 'Install for which agents?', choices, { multi: true, initial: existing ? [] : detected })
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
      if (optional.length) {
        step('Capabilities')
        io.out('Core is always installed.')
        capabilities = await io.select('Add optional capabilities', optional.map((c) => ({ id: c.id, label: c.label, hint: c.description })), { multi: true })
      }
    }
  }

  let contentRoot = options.contentRoot ?? existing?.contentRoot
  if (contentRoot === undefined) {
    const fallback = catalogue.roots.content.installedDefault
    if (ask) step('Folder')
    contentRoot = ask ? await chooseContentRoot(io, target.root, fallback) : fallback
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

  step('Review')
  renderPreview(io, target, bundle, plan, options.dryRun, options.noInstall)
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
    io.out('')
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
  const installed = await installPlayground(io, target.root, plan, options, ask)
  renderCompletion(io, bundle, plan, claudeImport, installed)
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

function renderPreview(io: Io, target: Target, bundle: Bundle, plan: Plan, full: boolean, noInstall: boolean): void {
  const { catalogue } = bundle
  const agentLabel = (id: string) => catalogue.agents.find((a) => a.id === id)?.label ?? id
  const capabilityLabel = (id: string) => catalogue.capabilities.find((c) => c.id === id)?.label ?? id
  const added = (all: string[], fresh: string[], label: (id: string) => string) =>
    all.map((id) => (plan.mode === 'add' && fresh.includes(id) ? `${label(id)} (new)` : label(id))).join(', ')
  const heading = (text: string) => io.out(`\n${paint(io, 'cyan', '▍')}${paint(io, 'bold', text)}`)

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
    plan.notes.push(`The prototype playground needs Node.js ${PLAYGROUND_NODE.join('.')} or later; this machine has ${io.nodeVersion}${ok ? '' : ', so upgrade Node.js before setting it up'}. ${ok ? (noInstall ? 'Its dependencies are not installed (--no-install).' : 'Its dependencies are installed after the files are written.') : 'Its dependencies are not installed.'}`)
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

function renderCompletion(io: Io, bundle: Bundle, plan: Plan, claudeImport: boolean, playgroundInstalled: boolean): void {
  const { catalogue } = bundle
  io.out('')
  io.out(paint(io, 'green', `✔ ${plan.mode === 'install' ? `Installed Product Owner Toolkit ${bundle.version}.` : 'Added to the Product Owner Toolkit installation.'}`))
  if (plan.claude.kind === 'import' && !claudeImport) {
    io.out(`${plan.claude.path} was left unchanged, so Claude Code will not see the toolkit map until you add \`@AGENTS.md\` to it. doctor reports this.`)
  }

  const next: string[][] = []
  if (plan.manifest.configuration.status === 'pending') {
    next.push([
      paint(io, 'bold', 'Files are installed, but company configuration is still pending.'),
      'Next, run the bootstrap-context skill to set up your company context:',
      ...plan.agents.map((id) => {
        const agent = catalogue.agents.find((a) => a.id === id)!
        return `  ${agent.label}: ${agent.invocation.replace('{skill}', 'bootstrap-context')}`
      }),
    ])
  }
  if (plan.addedCapabilities.includes('prototyping')) {
    next.push([
      paint(io, 'bold', 'Prototyping'),
      `The design profile in ${plan.contentRoot}/design-system/ is an example that you now own. Run design-system-setup to use your company's design sources.`,
      `To start the playground (Node.js ${PLAYGROUND_NODE.join('.')} or later): cd ${plan.manifest.playgroundRoot} && ${playgroundInstalled ? '' : 'npm install && '}npm start`,
    ])
  }
  next.push(['Check the installation at any time with: npx productownertoolkit@latest doctor'])

  const body = next.flatMap((lines, index) => [
    ...(index ? [''] : []),
    ...lines.map((line, i) => `${i === 0 ? paint(io, 'cyan', `${index + 1}.`) : '  '} ${line}`),
  ])
  io.out('')
  for (const line of card(io, 'What next', [...body, '', paint(io, 'dim', `Docs: ${REPOSITORY_URL}`)])) io.out(line)
}

const NEW_FOLDER = '\u0000new'

/** Offer the default and the folders already here, or a typed new name. */
async function chooseContentRoot(io: Io, root: string, fallback: string): Promise<string> {
  const dirs = fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== fallback)
    .map((e) => e.name)
  const exists = fs.existsSync(path.join(root, fallback))
  const choices = [
    { id: fallback, label: fallback, hint: exists ? '(default)' : '(default, will be created)' },
    ...dirs.map((id) => ({ id, label: id })),
    { id: NEW_FOLDER, label: 'Create a new folder…' },
  ]
  const [picked] = await io.select('Folder for your product work?', choices, { multi: false, initial: [fallback] })
  if (picked !== NEW_FOLDER) return picked ?? fallback
  return (await io.ask('New folder name: ')) || fallback
}

/** Install the playground dependencies when Prototyping was just added. Failure never undoes the install. */
async function installPlayground(io: Io, root: string, plan: Plan, options: CliOptions, ask: Io['ask'] | undefined): Promise<boolean> {
  const dir = plan.manifest.playgroundRoot
  if (!dir || !plan.addedCapabilities.includes('prototyping') || options.noInstall) return false
  if (!nodeSatisfies(io.nodeVersion, PLAYGROUND_NODE) || fs.existsSync(path.join(root, dir, 'node_modules'))) return false
  if (ask) {
    const answer = (await ask('Install the prototype playground dependencies now? [Y/n] ')).toLowerCase()
    if (answer !== '' && answer !== 'y' && answer !== 'yes') return false
  }
  io.out(`\nInstalling playground dependencies in ${dir}/ ...`)
  if ((await io.exec('npm', ['install'], path.join(root, dir))) === 0) return true
  io.err(`npm install failed. The toolkit is installed; retry with: cd ${dir} && npm install`)
  return false
}
