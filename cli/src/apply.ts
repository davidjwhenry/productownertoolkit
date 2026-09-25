/**
 * Apply an `init` plan. Only new files are written, so recovery is simple:
 * each path is re-checked immediately before writing, the manifest is
 * written last, and on any failure every file and folder this run created is
 * removed and the instruction files are restored.
 */
import fs from 'node:fs'
import { checksum, Target, writeFileAtomic } from './fsx.ts'
import { AGENTS_PATH } from './instructions.ts'
import { MANIFEST_PATH, serialiseManifest, type InstallationManifest } from './manifest.ts'
import type { Plan } from './planner.ts'

export class ApplyError extends Error {}

export interface ApplyOptions {
  /** Whether the user accepted the proposed `CLAUDE.md` import. */
  claudeImport: boolean
}

export function applyPlan(root: string, plan: Plan, options: ApplyOptions): InstallationManifest {
  if (plan.conflicts.length) throw new ApplyError('The plan has conflicts; nothing was written.')
  // A fresh view: the plan's snapshot must still describe the disk.
  const target = Target.open(root)
  const createdFiles: string[] = []
  const createdDirectories: string[] = []
  const restore: Array<{ path: string; text: string | undefined }> = []

  const create = (path: string, contents: Buffer) => {
    if (target.inspect(path).kind !== 'missing') throw new ApplyError(`${path} appeared after planning; nothing further was written.`)
    createdDirectories.push(...writeFileAtomic(target, path, contents))
    createdFiles.push(path)
  }
  const replace = (path: string, before: string | undefined, after: string) => {
    const current = target.readText(path)
    if (current !== before) throw new ApplyError(`${path} changed after planning; nothing further was written.`)
    restore.push({ path, text: before })
    if (before === undefined) createdFiles.push(path)
    createdDirectories.push(...writeFileAtomic(target, path, Buffer.from(after)))
  }

  const manifest: InstallationManifest = { ...plan.manifest }
  try {
    for (const file of plan.files) {
      if (file.action !== 'create') continue
      create(file.path, file.contents)
    }
    for (const file of plan.files) {
      if (file.action === 'adopt' && checksum(target.read(file.path) ?? Buffer.alloc(0)) !== checksum(file.contents)) {
        throw new ApplyError(`${file.path} changed after planning; nothing further was written.`)
      }
    }
    const agentsMd = plan.agentsMd
    if (agentsMd.kind === 'create') replace(AGENTS_PATH, undefined, agentsMd.after)
    else if (agentsMd.kind === 'insert' || agentsMd.kind === 'replace') replace(AGENTS_PATH, agentsMd.before, agentsMd.after)
    if (plan.claude.kind === 'import' && options.claudeImport) {
      replace(plan.claude.path, plan.claude.before, plan.claude.after)
      manifest.claudeImport = plan.claude.path
    }
    const manifestText = serialiseManifest(manifest)
    if (plan.mode === 'add') {
      restore.push({ path: MANIFEST_PATH, text: target.readText(MANIFEST_PATH) })
      writeFileAtomic(target, MANIFEST_PATH, Buffer.from(manifestText))
    } else {
      create(MANIFEST_PATH, Buffer.from(manifestText))
    }
    return manifest
  } catch (error) {
    rollback(target, createdFiles, createdDirectories, restore)
    throw error instanceof ApplyError ? error : new ApplyError(`Writing failed (${(error as Error).message}); every change from this run was undone.`)
  }
}

function rollback(target: Target, files: string[], directories: string[], restore: Array<{ path: string; text: string | undefined }>): void {
  for (const { path, text } of restore.reverse()) {
    if (text !== undefined) fs.writeFileSync(target.abs(path), text)
  }
  for (const path of files.reverse()) fs.rmSync(target.abs(path), { force: true })
  for (const dir of [...new Set(directories)].sort((a, b) => b.length - a.length)) {
    try {
      fs.rmdirSync(dir)
    } catch {
      // Not empty: something else lives there now, so leave it.
    }
  }
}
