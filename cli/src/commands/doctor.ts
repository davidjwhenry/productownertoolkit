/**
 * `doctor`: a read-only health report (DR.1–DR.6, ON.10). It never repairs
 * or rewrites anything; every finding names the path and the next safe step.
 */
import path from 'node:path'
import type { CliOptions } from '../args.ts'
import type { Bundle } from '../catalogue/bundle.ts'
import { checksum, isBlocked, Target, UnsafePathError } from '../fsx.ts'
import { AGENTS_OVERRIDE_PATH, AGENTS_PATH, CLAUDE_LOCAL_PATH, CLAUDE_PATHS, findManagedBlock, hasAgentsImport } from '../instructions.ts'
import { paint, type Io } from '../io.ts'
import { MANIFEST_DIRECTORY, MANIFEST_PATH, MANIFEST_SCHEMA_VERSION, parseManifest, type InstallationManifest } from '../manifest.ts'
import { nodeSatisfies } from './init.ts'

export type Severity = 'error' | 'warning' | 'info'

export interface Finding {
  severity: Severity
  code: string
  path?: string
  message: string
  action?: string
}

export interface DoctorReport {
  cliVersion: string
  target: string
  status: 'healthy' | 'unhealthy' | 'not-installed'
  installation: {
    schemaVersion: number
    toolkitVersion: string
    agents: string[]
    capabilities: string[]
    contentRoot: string
    contentRootPresent: boolean
    configuration: InstallationManifest['configuration']
  } | null
  findings: Finding[]
}

const TRANSACTION_PATH = `${MANIFEST_DIRECTORY}/transaction.json`

export function diagnose(target: Target, bundle: Bundle, nodeVersion: string): DoctorReport {
  const findings: Finding[] = []
  const add = (finding: Finding) => findings.push(finding)
  const report = (installation: DoctorReport['installation']): DoctorReport => ({
    cliVersion: bundle.version,
    target: target.root,
    status: installation === null && !findings.some((f) => f.severity === 'error' && f.code !== 'not-installed')
      ? 'not-installed'
      : findings.some((f) => f.severity === 'error') ? 'unhealthy' : 'healthy',
    installation,
    findings,
  })

  const manifestEntry = target.inspect(MANIFEST_PATH)
  if (manifestEntry.kind === 'missing') {
    add({ severity: 'error', code: 'not-installed', path: MANIFEST_PATH, message: 'No Product Owner Toolkit installation was found here.', action: 'Run npx productownertoolkit@latest init to install it.' })
    return report(null)
  }
  if (manifestEntry.kind !== 'file') {
    add({ severity: 'error', code: 'manifest-unreadable', path: MANIFEST_PATH, message: `${MANIFEST_PATH} is not a regular file.`, action: 'Restore the installation manifest from version control.' })
    return report(null)
  }
  const read = parseManifest(target.readText(MANIFEST_PATH)!)
  if (read.kind !== 'valid') {
    add({
      severity: 'error',
      code: read.kind === 'unsupported' ? 'manifest-unsupported' : 'manifest-invalid',
      path: MANIFEST_PATH,
      message: read.message,
      action: read.kind === 'unsupported' ? 'Use the newest CLI: npx productownertoolkit@latest doctor' : 'Restore the installation manifest from version control.',
    })
    return report(null)
  }
  const manifest = read.manifest

  const transaction = target.inspect(TRANSACTION_PATH)
  if (transaction.kind !== 'missing') {
    let state = 'unknown'
    try {
      state = String((JSON.parse(target.readText(TRANSACTION_PATH) ?? '') as { state?: unknown }).state ?? 'unknown')
    } catch {
      // Reported as unknown below.
    }
    add({ severity: 'error', code: 'transaction-pending', path: TRANSACTION_PATH, message: `An update transaction was left in the "${state}" state.`, action: 'Do not edit toolkit files. Rerun the same CLI version, which recovers the transaction before anything else.' })
  }

  const contentEntry = manifest.contentRoot === '.' ? { kind: 'directory' as const } : target.inspect(manifest.contentRoot)
  const contentRootPresent = contentEntry.kind === 'directory'
  if (!contentRootPresent) {
    add({
      severity: 'error',
      code: 'content-root-missing',
      path: manifest.contentRoot,
      message: isBlocked(contentEntry) ? `The content root ${manifest.contentRoot}/ cannot be used: ${contentEntry.at} is a ${contentEntry.kind}.` : `The content root ${manifest.contentRoot}/ does not exist.`,
      action: 'Restore it from version control; your product work lives there.',
    })
  }

  // Managed files, grouped so a missing skill reads as an incomplete agent mirror.
  for (const [rel, expected] of Object.entries(manifest.managedFiles)) {
    const skillDir = manifest.skillDirectories.find((dir) => rel.startsWith(`${dir}/`))
    const entry = target.inspect(rel)
    if (entry.kind !== 'file') {
      add({
        severity: 'error',
        code: skillDir ? 'skill-file-missing' : 'managed-file-missing',
        path: rel,
        message: skillDir ? `The ${skillDir}/ mirror is incomplete: ${rel} is missing.` : `Managed file ${rel} is missing.`,
        action: 'Restore it from version control. The toolkit does not recreate managed files silently.',
      })
    } else if (checksum(target.read(rel)!) !== expected) {
      add({ severity: 'error', code: 'managed-file-modified', path: rel, message: `Managed file ${rel} has been changed since it was installed.`, action: 'Restore it from version control, or keep your change and expect future updates to stop until it is resolved.' })
    }
  }

  const agentsText = target.inspect(AGENTS_PATH).kind === 'file' ? target.readText(AGENTS_PATH) : undefined
  if (agentsText === undefined) {
    add({ severity: 'error', code: 'agents-md-missing', path: AGENTS_PATH, message: `${AGENTS_PATH} is missing, so agents cannot see the toolkit map.`, action: 'Restore it from version control, or run init again to add the toolkit section.' })
  } else {
    const block = findManagedBlock(agentsText)
    if (block.kind === 'absent') {
      add({ severity: 'error', code: 'managed-block-missing', path: AGENTS_PATH, message: `${AGENTS_PATH} has no Product Owner Toolkit block.`, action: 'Run init again to add it.' })
    } else if (block.kind === 'malformed') {
      add({ severity: 'error', code: 'managed-block-malformed', path: AGENTS_PATH, message: `The Product Owner Toolkit block in ${AGENTS_PATH} is malformed: ${block.message}.`, action: 'Leave exactly one pair of begin and end markers.' })
    } else if (checksum(Buffer.from(block.text)) !== manifest.managedBlock.checksum) {
      add({ severity: 'warning', code: 'managed-block-modified', path: AGENTS_PATH, message: `The Product Owner Toolkit block in ${AGENTS_PATH} has been edited.`, action: 'Move your notes outside the markers; the block is replaced on update.' })
    }
  }
  if (target.inspect(AGENTS_OVERRIDE_PATH).kind !== 'missing') {
    add({ severity: 'error', code: 'agents-override', path: AGENTS_OVERRIDE_PATH, message: `${AGENTS_OVERRIDE_PATH} exists, so Codex may ignore the toolkit map in ${AGENTS_PATH}.`, action: `Merge ${AGENTS_OVERRIDE_PATH} into ${AGENTS_PATH} or remove it.` })
  }

  if (manifest.agents.includes('claude-code')) {
    const present = CLAUDE_PATHS.filter((p) => target.inspect(p).kind === 'file')
    if (present.length > 1) {
      add({ severity: 'warning', code: 'claude-md-ambiguous', path: present.join(', '), message: `Both ${present.join(' and ')} exist.`, action: 'Keep one, and make sure it imports AGENTS.md.' })
    }
    for (const p of present) {
      if (!hasAgentsImport(target.readText(p)!, p)) {
        add({ severity: 'warning', code: 'claude-md-no-import', path: p, message: `${p} does not import AGENTS.md, so Claude Code does not see the toolkit map.`, action: `Add ${p.includes('/') ? '@../AGENTS.md' : '@AGENTS.md'} as the first line.` })
      }
    }
    if (target.inspect(CLAUDE_LOCAL_PATH).kind === 'file' && !hasAgentsImport(target.readText(CLAUDE_LOCAL_PATH)!, CLAUDE_LOCAL_PATH)) {
      add({ severity: 'warning', code: 'claude-local-no-import', path: CLAUDE_LOCAL_PATH, message: `${CLAUDE_LOCAL_PATH} does not import AGENTS.md, which can hide the toolkit map from Claude Code.`, action: 'Add @AGENTS.md to it if Claude Code does not follow the toolkit instructions.' })
    }
  }

  if (manifest.configuration.status === 'pending') {
    add({ severity: 'info', code: 'configuration-pending', message: 'Company configuration is pending.', action: 'Run the bootstrap-context skill in your agent.' })
  }

  if (manifest.playgroundRoot) {
    const playground = manifest.playgroundRoot
    const content = manifest.contentRoot === '.' ? '' : `${manifest.contentRoot}/`
    const active = `${content}design-system/profiles/ACTIVE`
    const version = target.readText(active)?.split(/\r?\n/)[0]?.trim()
    if (!version) {
      add({ severity: 'warning', code: 'design-profile-missing', path: active, message: 'No active design profile is set, so the playground has nothing to render with.', action: 'Run the design-system-setup skill.' })
    } else if (target.inspect(`${content}design-system/profiles/${version}/profile.json`).kind !== 'file') {
      add({ severity: 'warning', code: 'design-profile-missing', path: active, message: `The active design profile ${version} has no profile.json.`, action: 'Run the design-system-setup skill.' })
    }
    if (!nodeSatisfies(nodeVersion, [22, 12])) {
      add({ severity: 'info', code: 'playground-node', message: `The prototype playground needs Node.js 22.12 or later; this machine has ${nodeVersion}.`, action: 'Upgrade Node.js before running the playground.' })
    }
    if (target.inspect(`${playground}/node_modules`).kind !== 'directory') {
      add({ severity: 'info', code: 'playground-dependencies', path: `${playground}/node_modules`, message: 'The playground dependencies are not installed.', action: `cd ${playground} && npm install` })
    }
  }

  if (manifest.toolkitVersion !== bundle.version) {
    add({ severity: 'info', code: 'version-differs', message: `This installation uses toolkit ${manifest.toolkitVersion}; this CLI is ${bundle.version}.` })
  }

  return report({
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    toolkitVersion: manifest.toolkitVersion,
    agents: manifest.agents,
    capabilities: manifest.capabilities,
    contentRoot: manifest.contentRoot,
    contentRootPresent,
    configuration: manifest.configuration,
  })
}

export function runDoctor(options: CliOptions, io: Io, bundle: Bundle): number {
  let target: Target
  try {
    target = Target.open(path.resolve(io.cwd, options.target ?? '.'))
  } catch (error) {
    if (!(error instanceof UnsafePathError)) throw error
    io.err(error.message)
    return 1
  }
  const result = diagnose(target, bundle, io.nodeVersion)
  if (options.json) {
    io.out(JSON.stringify(result, null, 2))
  } else {
    renderReport(io, bundle, result)
  }
  return result.status === 'healthy' ? 0 : 1
}

function renderReport(io: Io, bundle: Bundle, result: DoctorReport): void {
  const { catalogue } = bundle
  io.out(paint(io, 'bold', `Product Owner Toolkit doctor (CLI ${result.cliVersion})`))
  io.out(`  Target:        ${result.target}`)
  const installation = result.installation
  if (installation) {
    io.out(`  Installation:  toolkit ${installation.toolkitVersion}, manifest schema ${installation.schemaVersion}`)
    io.out(`  Agents:        ${installation.agents.map((id) => catalogue.agents.find((a) => a.id === id)?.label ?? id).join(', ')}`)
    io.out(`  Capabilities:  ${installation.capabilities.map((id) => catalogue.capabilities.find((c) => c.id === id)?.label ?? id).join(', ')}`)
    io.out(`  Content root:  ${installation.contentRoot}/ (${installation.contentRootPresent ? 'present' : 'missing'})`)
    io.out(`  Configuration: ${installation.configuration.status}${installation.configuration.completedAt ? ` (${installation.configuration.completedAt})` : ''}`)
  }
  if (result.findings.length) {
    io.out('')
    const labels: Record<Severity, string> = { error: paint(io, 'red', 'ERROR  '), warning: paint(io, 'yellow', 'WARNING'), info: 'INFO   ' }
    for (const finding of result.findings) {
      io.out(`  ${labels[finding.severity]} ${finding.message}`)
      if (finding.action) io.out(`          Next: ${finding.action}`)
    }
  }
  io.out('')
  const errors = result.findings.filter((f) => f.severity === 'error').length
  const warnings = result.findings.filter((f) => f.severity === 'warning').length
  if (result.status === 'healthy') io.out(paint(io, 'green', `Healthy${warnings ? `, with ${warnings} warning${warnings === 1 ? '' : 's'}` : ''}.`))
  else if (result.status === 'not-installed') io.out('Not installed.')
  else io.out(paint(io, 'red', `${errors} problem${errors === 1 ? '' : 's'} found. doctor changed nothing.`))
}
