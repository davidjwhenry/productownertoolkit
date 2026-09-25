/**
 * The installation planner. It reads the target (never writing) and returns
 * every file to create or adopt, the instruction-file changes, the manifest
 * to record, and every conflict. `init`, `init --dry-run`, and the preview
 * all use the same plan, so what is shown is exactly what is written.
 */
import { allSkillDirectories, skillDirectoriesFor } from './catalogue/agents.ts'
import { renderAgentsBlock } from './catalogue/agents-block.ts'
import { desiredFiles, selectedCapabilities, type Bundle, type DesiredFile, type Ownership } from './catalogue/bundle.ts'
import { matchesAny } from './catalogue/glob.ts'
import { checksum, isBlocked, isSafeRelativePath, joinRelative, type Entry, type Target } from './fsx.ts'
import {
  AGENTS_OVERRIDE_PATH,
  AGENTS_PATH,
  findManagedBlock,
  planAgentsMd,
  planClaudeImport,
  type AgentsPlan,
  type ClaudePlan,
} from './instructions.ts'
import { MANIFEST_DIRECTORY, MANIFEST_PATH, MANIFEST_SCHEMA_VERSION, type InstallationManifest } from './manifest.ts'

export interface PlanRequest {
  agents: string[]
  /** Optional capabilities; required ones are always included. */
  capabilities: string[]
  contentRoot: string
  /** The valid manifest of an existing installation, when adding to it (IN.10). */
  existing?: InstallationManifest
  now: string
}

/** `create` writes a new file; `adopt` records an identical existing file; `keep` leaves a different user-owned file alone. */
export type FileAction = 'create' | 'adopt' | 'keep'

export interface PlannedFile {
  path: string
  action: FileAction
  ownership: Ownership
  capability: string
  contents: Buffer
}

export interface Conflict {
  path: string
  message: string
}

export interface Plan {
  mode: 'install' | 'add'
  agents: string[]
  capabilities: string[]
  addedAgents: string[]
  addedCapabilities: string[]
  contentRoot: string
  toolkitRoot: string
  skillDirectories: string[]
  files: PlannedFile[]
  agentsMd: AgentsPlan
  claude: ClaudePlan
  conflicts: Conflict[]
  notes: string[]
  /** The manifest to write if the plan is applied without the `CLAUDE.md` import. */
  manifest: InstallationManifest
}

export class PlanError extends Error {}

const RESERVED_ROOTS = ['.git', 'node_modules', MANIFEST_DIRECTORY, 'prototype-playground']

/** Reject content roots that are unsafe or that would overlap a managed location. */
export function validateContentRoot(bundle: Bundle, contentRoot: string): string | undefined {
  if (contentRoot !== '.' && !isSafeRelativePath(contentRoot)) {
    return `The content root must be a relative folder inside the target, using "/" separators: ${JSON.stringify(contentRoot)}`
  }
  const first = contentRoot.split('/')[0]!.toLowerCase()
  const skillRoots = allSkillDirectories(bundle.catalogue).map((dir) => dir.split('/')[0]!.toLowerCase())
  if ([...RESERVED_ROOTS, ...skillRoots].some((reserved) => reserved.toLowerCase() === first)) {
    return `The content root cannot be inside ${contentRoot.split('/')[0]}/, which the toolkit or your tools manage`
  }
  return undefined
}

function blockedMessage(entry: Entry): string {
  switch (entry.kind) {
    case 'symlink':
      return `${entry.at} is a symlink; the installer never writes through symlinks`
    case 'special':
      return `${entry.at} is not a regular file or folder`
    case 'not-directory':
      return `${entry.at} is a file where the installer needs a folder`
    case 'case-mismatch':
      return `${entry.at} differs only in letter case from a path the installer needs`
    default:
      return `${entry.at} cannot be written`
  }
}

export function plan(target: Target, bundle: Bundle, request: PlanRequest): Plan {
  const { catalogue } = bundle
  const existing = request.existing

  const unknownAgents = request.agents.filter((id) => !catalogue.agents.some((a) => a.id === id))
  if (unknownAgents.length) throw new PlanError(`Unknown agent: ${unknownAgents.join(', ')}. Choose from ${catalogue.agents.map((a) => a.id).join(', ')}.`)
  const optional = catalogue.capabilities.filter((c) => !c.required).map((c) => c.id)
  const unknownCapabilities = request.capabilities.filter((id) => !optional.includes(id))
  if (unknownCapabilities.length) throw new PlanError(`Unknown capability: ${unknownCapabilities.join(', ')}. Choose from ${optional.join(', ')}.`)

  if (existing) {
    if (existing.contentRoot !== request.contentRoot) {
      throw new PlanError(`This installation keeps product work in ${existing.contentRoot}/; the content root cannot be changed.`)
    }
    if (existing.toolkitVersion !== bundle.version) {
      throw new PlanError(
        `This installation uses toolkit ${existing.toolkitVersion}, but this CLI is ${bundle.version}. Adding to it would mix versions; run npx productownertoolkit@${existing.toolkitVersion} init instead.`,
      )
    }
  }
  const contentProblem = validateContentRoot(bundle, request.contentRoot)
  if (contentProblem) throw new PlanError(contentProblem)

  const agents = catalogue.agents.map((a) => a.id).filter((id) => request.agents.includes(id) || existing?.agents.includes(id))
  if (agents.length === 0) throw new PlanError('Select at least one agent.')
  const capabilities = selectedCapabilities(catalogue, [...request.capabilities, ...(existing?.capabilities ?? [])]).map((c) => c.id)
  const skillDirectories = skillDirectoriesFor(catalogue, agents, existing?.skillDirectories ?? [])
  const roots = { content: request.contentRoot, toolkit: catalogue.roots.toolkit.installedDefault }
  const conflicts: Conflict[] = []
  const conflict = (path: string, message: string) => {
    if (!conflicts.some((c) => c.message === message)) conflicts.push({ path, message })
  }

  // Everything the full selection installs; paths the installation already manages are left alone.
  const desired = desiredFiles(bundle, { skillDirectories, capabilities, roots })
  const alreadyManaged = new Set(Object.keys(existing?.managedFiles ?? {}))
  const previousCapabilities = new Set(existing?.capabilities ?? [])
  const fresh = desired.filter((file) => {
    if (alreadyManaged.has(file.path)) return false
    // Seed content of a capability that is already installed belongs to the user now.
    if (file.ownership === 'seed' && previousCapabilities.has(file.capability)) return false
    return true
  })

  const seen = new Map<string, string>()
  for (const file of desired) {
    const lower = file.path.toLowerCase()
    const other = seen.get(lower)
    if (other !== undefined && other !== file.path) conflict(file.path, `The toolkit would install both ${other} and ${file.path}, which differ only in letter case`)
    seen.set(lower, file.path)
  }

  const files: PlannedFile[] = []
  for (const file of fresh) {
    const entry = target.inspect(file.path)
    if (isBlocked(entry)) {
      conflict(entry.at ?? file.path, blockedMessage(entry))
      continue
    }
    if (entry.kind === 'directory') {
      conflict(file.path, `${file.path} is a folder where the toolkit installs a file`)
      continue
    }
    const planned = { path: file.path, ownership: file.ownership, capability: file.capability, contents: file.contents }
    if (entry.kind === 'missing') {
      files.push({ ...planned, action: 'create' })
      continue
    }
    const current = target.read(file.path)!
    if (checksum(current) === checksum(file.contents)) files.push({ ...planned, action: 'adopt' })
    else if (file.ownership === 'seed') files.push({ ...planned, action: 'keep' })
    else conflict(file.path, `${file.path} already exists with different content`)
  }

  checkForeignDirectories(target, bundle, { desired, fresh, agents, capabilities, alreadyManaged, conflict })

  // Instruction files.
  if (target.inspect(AGENTS_OVERRIDE_PATH).kind !== 'missing') {
    conflict(AGENTS_OVERRIDE_PATH, `${AGENTS_OVERRIDE_PATH} exists and changes which instructions Codex reads, so the toolkit map in ${AGENTS_PATH} could be ignored. Remove or merge it, then run again.`)
  }
  const readInstruction = (path: string): string | undefined => {
    const entry = target.inspect(path)
    if (isBlocked(entry)) {
      conflict(entry.at ?? path, blockedMessage(entry))
      return undefined
    }
    if (entry.kind === 'directory') {
      conflict(path, `${path} is a folder`)
      return undefined
    }
    return target.readText(path)
  }
  const agentsText = readInstruction(AGENTS_PATH)
  const renderBlock = (headingLevel: number) =>
    renderAgentsBlock(bundle.agentsBlockTemplate, catalogue, { capabilities, agents, roots, manifestPath: MANIFEST_PATH, headingLevel })
  if (existing && agentsText !== undefined) {
    const location = findManagedBlock(agentsText)
    if (location.kind === 'valid' && checksum(Buffer.from(location.text)) !== existing.managedBlock.checksum) {
      conflict(AGENTS_PATH, `The Product Owner Toolkit block in ${AGENTS_PATH} has been edited since it was installed. Move your changes outside the markers, or restore the block, then run again.`)
    }
  }
  const agentsMd = planAgentsMd(agentsText, renderBlock)
  if (agentsMd.kind === 'conflict') conflict(AGENTS_PATH, agentsMd.message)
  const claude = planClaudeImport(readInstruction, agents.includes('claude-code'))
  if (claude.kind === 'conflict') conflict('CLAUDE.md', claude.message)

  const manifestEntry = target.inspect(MANIFEST_PATH)
  if (isBlocked(manifestEntry)) conflict(manifestEntry.at ?? MANIFEST_PATH, blockedMessage(manifestEntry))
  else if (!existing && manifestEntry.kind !== 'missing') conflict(MANIFEST_PATH, `${MANIFEST_PATH} exists but is not a file the installer can read`)

  const notes: string[] = []
  const cursor = catalogue.agents.find((a) => a.id === 'cursor')
  if (agents.includes('cursor') && cursor && skillDirectories.filter((dir) => cursor.reads.includes(dir)).length > 1) {
    notes.push(`Cursor reads both ${skillDirectories.filter((dir) => cursor.reads.includes(dir)).join(' and ')}, so it lists each toolkit skill twice. This is expected.`)
  }

  const managedFiles: Record<string, string> = { ...(existing?.managedFiles ?? {}) }
  for (const file of files) {
    if (file.ownership === 'managed') managedFiles[file.path] = checksum(file.contents)
  }
  const blockText = agentsMd.kind === 'conflict' ? '' : (findManagedBlock(agentsMd.after) as { text?: string }).text ?? ''
  const runtime = selectedCapabilities(catalogue, capabilities).find((c) => c.runtime)?.runtime
  const manifest: InstallationManifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    toolkitVersion: bundle.version,
    contentRoot: request.contentRoot,
    toolkitRoot: roots.toolkit,
    ...(runtime ? { playgroundRoot: runtime.install } : {}),
    agents,
    skillDirectories,
    capabilities,
    managedFiles,
    managedBlock: { path: AGENTS_PATH, checksum: checksum(Buffer.from(blockText)) },
    ...(existing?.claudeImport ? { claudeImport: existing.claudeImport } : {}),
    installedAt: existing?.installedAt ?? request.now,
    updatedAt: request.now,
    configuration: existing?.configuration ?? { status: 'pending', completedAt: null },
  }

  return {
    mode: existing ? 'add' : 'install',
    // A folder-level conflict explains every file conflict inside it.
    conflicts: conflicts.filter((c) => !conflicts.some((d) => d !== c && c.path.startsWith(`${d.path}/`))),
    agents,
    capabilities,
    addedAgents: existing ? agents.filter((id) => !existing.agents.includes(id)) : agents,
    addedCapabilities: existing ? capabilities.filter((id) => !existing.capabilities.includes(id)) : capabilities,
    contentRoot: request.contentRoot,
    toolkitRoot: roots.toolkit,
    skillDirectories,
    files,
    agentsMd,
    claude,
    notes,
    manifest,
  }
}

/**
 * Folders the toolkit installs as a whole must not already hold someone
 * else's files: a skill folder with a toolkit skill's name in any folder the
 * selected agents read (CP.11), and a different `prototype-playground/` (CP.12).
 */
function checkForeignDirectories(
  target: Target,
  bundle: Bundle,
  context: {
    desired: DesiredFile[]
    fresh: DesiredFile[]
    agents: string[]
    capabilities: string[]
    alreadyManaged: Set<string>
    conflict: (path: string, message: string) => void
  },
): void {
  const { catalogue } = bundle
  const desiredPaths = new Set(context.desired.map((file) => file.path))
  const freshSkills = new Set(context.fresh.filter((file) => file.skill).map((file) => file.skill!))
  const readFolders = [...new Set(catalogue.agents.filter((a) => context.agents.includes(a.id)).flatMap((a) => a.reads))]

  for (const skill of freshSkills) {
    for (const folder of readFolders) {
      const dir = joinRelative(folder, skill)
      if (context.alreadyManaged.has(joinRelative(dir, 'SKILL.md'))) continue
      if (target.inspect(dir).kind !== 'directory') continue
      const foreign = target.walk(dir).filter((entry) => entry.kind !== 'file' || !desiredPaths.has(joinRelative(dir, entry.path)))
      const differs = target.walk(dir).some((entry) => {
        const path = joinRelative(dir, entry.path)
        const wanted = context.desired.find((file) => file.path === path)
        return wanted !== undefined && checksum(target.read(path) ?? Buffer.alloc(0)) !== checksum(wanted.contents)
      })
      if (foreign.length || differs) {
        context.conflict(dir, `A skill named ${skill} already exists at ${dir}/. Rename or remove it, then run again; two skills with one name would be ambiguous to the agent.`)
      }
    }
  }

  const runtime = selectedCapabilities(catalogue, context.capabilities).find((c) => c.runtime)?.runtime
  if (runtime && context.fresh.some((file) => file.path.startsWith(`${runtime.install}/`))) {
    const root = runtime.install
    const entry = target.inspect(root)
    if (entry.kind === 'directory') {
      const extras = target
        .walk(root, (rel) => matchesAny(`${rel}/-`, runtime.unmanaged))
        .filter((file) => !matchesAny(file.path, runtime.unmanaged))
        .filter((file) => file.kind !== 'file' || !desiredPaths.has(joinRelative(root, file.path)))
      const differs = context.fresh.some((file) => {
        if (!file.path.startsWith(`${root}/`) || file.ownership === 'seed') return false
        const current = target.read(file.path)
        return current !== undefined && checksum(current) !== checksum(file.contents)
      })
      if (extras.length || differs) {
        context.conflict(root, `A different ${root}/ already exists. Move or rename it, then run again.`)
      }
    }
  }
}
