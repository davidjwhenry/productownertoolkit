/**
 * Filesystem access confined to one target directory (IN.9, UP.14). Paths
 * inside the target are POSIX-style and relative; every lookup walks the path
 * one segment at a time without following symlinks, so a symlink or a
 * case-only name difference anywhere on the way is reported rather than
 * crossed.
 */
import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export type EntryKind = 'missing' | 'file' | 'directory' | 'symlink' | 'special' | 'not-directory' | 'case-mismatch'

export interface Entry {
  kind: EntryKind
  /** For blocked lookups (`symlink`, `special`, `not-directory`, `case-mismatch`): the existing path that blocks it. */
  at?: string
}

/** Paths that make a lookup unsafe or impossible to write through. */
export function isBlocked(entry: Entry): boolean {
  return entry.kind === 'symlink' || entry.kind === 'special' || entry.kind === 'not-directory' || entry.kind === 'case-mismatch'
}

export class UnsafePathError extends Error {}

/** A relative, `/`-separated path with no empty, `.` or `..` segments and no backslashes. */
export function isSafeRelativePath(rel: string): boolean {
  if (rel === '' || rel.includes('\\') || rel.includes('\0')) return false
  if (path.posix.isAbsolute(rel) || path.win32.isAbsolute(rel)) return false
  return rel.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
}

export function assertSafeRelativePath(rel: string): void {
  if (!isSafeRelativePath(rel)) throw new UnsafePathError(`Unsafe path: ${JSON.stringify(rel)}`)
}

export function joinRelative(...parts: string[]): string {
  return parts.filter((part) => part !== '' && part !== '.').join('/')
}

/** Text files contain no NUL byte; everything else is treated as binary. */
export function isText(bytes: Uint8Array): boolean {
  return !bytes.includes(0)
}

/** Text is written and checksummed with LF line endings; binary bytes are left as they are. */
export function normalise(bytes: Buffer): Buffer {
  if (!isText(bytes) || !bytes.includes(13)) return bytes
  return Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'))
}

export function checksum(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(normalise(bytes)).digest('hex')}`
}

/**
 * Read-only view of one target directory. Directory listings are cached for
 * the lifetime of the object, so a planning pass sees one consistent snapshot.
 */
export class Target {
  readonly root: string
  private readonly listings = new Map<string, Map<string, fs.Dirent> | null>()

  private constructor(root: string) {
    this.root = root
  }

  /** Open an existing directory as a target. The directory itself may be reached through a symlink. */
  static open(dir: string): Target {
    let root: string
    try {
      root = fs.realpathSync(dir)
    } catch {
      throw new UnsafePathError(`Target directory does not exist: ${dir}`)
    }
    if (!fs.statSync(root).isDirectory()) throw new UnsafePathError(`Target is not a directory: ${dir}`)
    return new Target(root)
  }

  abs(rel: string): string {
    if (rel === '') return this.root
    assertSafeRelativePath(rel)
    return path.join(this.root, ...rel.split('/'))
  }

  private listing(rel: string): Map<string, fs.Dirent> | null {
    let cached = this.listings.get(rel)
    if (cached === undefined) {
      try {
        cached = new Map(fs.readdirSync(this.abs(rel), { withFileTypes: true }).map((d) => [d.name, d]))
      } catch {
        cached = null
      }
      this.listings.set(rel, cached)
    }
    return cached
  }

  /** Classify `rel` without following symlinks at any segment. */
  inspect(rel: string): Entry {
    if (rel === '') return { kind: 'directory' }
    assertSafeRelativePath(rel)
    const segments = rel.split('/')
    let parent = ''
    for (let i = 0; i < segments.length; i++) {
      const name = segments[i]!
      const current = joinRelative(parent, name)
      const entries = this.listing(parent)
      if (!entries) return { kind: 'missing' }
      const dirent = entries.get(name)
      if (!dirent) {
        const lower = name.toLowerCase()
        for (const other of entries.keys()) {
          if (other.toLowerCase() === lower) return { kind: 'case-mismatch', at: joinRelative(parent, other) }
        }
        return { kind: 'missing' }
      }
      const last = i === segments.length - 1
      if (dirent.isSymbolicLink()) return { kind: 'symlink', at: current }
      if (dirent.isDirectory()) {
        if (last) return { kind: 'directory' }
      } else if (dirent.isFile()) {
        return last ? { kind: 'file' } : { kind: 'not-directory', at: current }
      } else {
        return { kind: 'special', at: current }
      }
      parent = current
    }
    return { kind: 'missing' }
  }

  read(rel: string): Buffer | undefined {
    if (this.inspect(rel).kind !== 'file') return undefined
    return fs.readFileSync(this.abs(rel))
  }

  readText(rel: string): string | undefined {
    return this.read(rel)?.toString('utf8')
  }

  /** Names in a directory, or an empty list when it is not a plain directory. */
  list(rel: string): Array<{ name: string; kind: 'file' | 'directory' | 'other' }> {
    if (this.inspect(rel).kind !== 'directory') return []
    return [...(this.listing(rel)?.values() ?? [])].map((d) => ({
      name: d.name,
      kind: d.isSymbolicLink() ? 'other' : d.isDirectory() ? 'directory' : d.isFile() ? 'file' : 'other',
    }))
  }

  /** Every file below `rel`, relative to `rel`, skipping paths `skip` rejects. Symlinks and special files are returned as `other`. */
  walk(rel: string, skip: (relPath: string) => boolean = () => false): Array<{ path: string; kind: 'file' | 'other' }> {
    const out: Array<{ path: string; kind: 'file' | 'other' }> = []
    const visit = (dir: string, prefix: string): void => {
      for (const entry of this.list(dir)) {
        const child = joinRelative(prefix, entry.name)
        if (skip(child)) continue
        if (entry.kind === 'directory') visit(joinRelative(dir, entry.name), child)
        else out.push({ path: child, kind: entry.kind })
      }
    }
    visit(rel, '')
    return out.sort((a, b) => (a.path < b.path ? -1 : 1))
  }
}

/**
 * Write `bytes` to `rel` through a temporary file and a rename. Parent
 * directories are created as needed; the caller has already checked that no
 * segment is a symlink. Returns the directories it created, deepest first.
 */
export function writeFileAtomic(target: Target, rel: string, bytes: Buffer): string[] {
  const abs = target.abs(rel)
  const created: string[] = []
  let dir = path.dirname(abs)
  while (!fs.existsSync(dir)) {
    created.push(dir)
    dir = path.dirname(dir)
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  const temp = `${abs}.pot-${randomBytes(6).toString('hex')}.tmp`
  fs.writeFileSync(temp, bytes, { flag: 'wx' })
  try {
    renameWithRetry(temp, abs)
  } catch (error) {
    fs.rmSync(temp, { force: true })
    throw error
  }
  return created
}

function renameWithRetry(from: string, to: string): void {
  // Windows can briefly lock a file that an editor or indexer has open.
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(from, to)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (attempt >= 4 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw error
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * (attempt + 1))
    }
  }
}
