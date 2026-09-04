/**
 * The single repository path resolver.
 *
 * Canonicalises the repository root once, then authorises every repository
 * file against a field-specific authority before reading it: relative paths
 * are syntax-checked, joined under the canonical root, verified as regular
 * files (never symlinks or special files), and contained via `realpath`.
 * Bounded bytes needed for JSON/HTML generation are cached per snapshot;
 * larger authorised files are hashed through bounded streams.
 */
import { createHash, type Hash } from 'node:crypto'
import { createReadStream, type Dirent, type Stats } from 'node:fs'
import { lstat, readdir, readFile, realpath, stat } from 'node:fs/promises'
import { finished } from 'node:stream/promises'
import path from 'node:path'

/** Diagnostic codes raised by the resolver itself. */
export type PathErrorCode = 'SOURCE_NOT_FOUND' | 'PATH_NOT_AUTHORISED' | 'FILE_TOO_LARGE'

export class PathError extends Error {
  constructor(
    readonly code: PathErrorCode,
    readonly relPath: string,
    message: string,
  ) {
    super(message)
    this.name = 'PathError'
  }
}

/**
 * Field-specific authorities. Authorisation happens after containment: a
 * path must resolve inside the repository root *and* inside the narrower
 * root its field demands (PRD in the feature's `prd/`, entries in the
 * prototype's `variants/`, companions in its `companions/`, profile
 * artefacts in their `vNNN/`, raw sources under `design-system/`).
 */
export type FileAuthority =
  | { kind: 'design-system' }
  | { kind: 'profile-active' }
  | { kind: 'profile-version'; version: string }
  | { kind: 'feature-prd'; featureDir: string }
  | { kind: 'prototype-variants'; prototypeDir: string }
  | { kind: 'prototype-companions'; prototypeDir: string }

/** Identity of one read file, used for caching and hand-off snapshot re-checks. */
export type FileSnapshot = {
  /** Canonical absolute path. */
  absPath: string
  /** Repository-root-relative POSIX path. */
  relPath: string
  size: number
  dev: number
  ino: number
  sha256: string
}

export type ResolvedFile = FileSnapshot & {
  bytes: Buffer
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

/**
 * Validate repository-root-relative path syntax: POSIX segments only.
 * Rejects NUL/control characters, backslashes, absolute/URL/UNC/drive
 * forms, empty segments, `.`, and `..`.
 */
export function assertSafeRelativePath(relPath: string): void {
  if (relPath.length === 0) {
    throw new PathError('PATH_NOT_AUTHORISED', relPath, 'Path must not be empty')
  }
  if (relPath.length > 1024) {
    throw new PathError('PATH_NOT_AUTHORISED', relPath, 'Path exceeds 1,024 characters')
  }
  if (CONTROL_CHARS.test(relPath)) {
    throw new PathError('PATH_NOT_AUTHORISED', relPath, 'Path contains control characters')
  }
  if (relPath.includes('\\')) {
    throw new PathError('PATH_NOT_AUTHORISED', relPath, 'Path contains a backslash')
  }
  if (/^[a-zA-Z]:/.test(relPath)) {
    throw new PathError('PATH_NOT_AUTHORISED', relPath, 'Path looks like a drive path')
  }
  if (relPath.startsWith('//')) {
    throw new PathError('PATH_NOT_AUTHORISED', relPath, 'Path looks like a UNC path')
  }
  if (relPath.includes('://')) {
    throw new PathError('PATH_NOT_AUTHORISED', relPath, 'Path looks like a URL')
  }
  if (relPath.startsWith('/')) {
    throw new PathError('PATH_NOT_AUTHORISED', relPath, 'Path must be repository-relative')
  }
  for (const segment of relPath.split('/')) {
    if (segment.length === 0) {
      throw new PathError('PATH_NOT_AUTHORISED', relPath, 'Path contains an empty segment')
    }
    if (segment === '.' || segment === '..') {
      throw new PathError('PATH_NOT_AUTHORISED', relPath, `Path contains forbidden segment "${segment}"`)
    }
  }
}

function authorityPrefix(authority: FileAuthority): string {
  switch (authority.kind) {
    case 'design-system':
      return 'design-system/'
    case 'profile-active':
      return 'design-system/profiles/ACTIVE'
    case 'profile-version':
      return `design-system/profiles/${authority.version}/`
    case 'feature-prd':
      return `${authority.featureDir}/prd/`
    case 'prototype-variants':
      return `${authority.prototypeDir}/variants/`
    case 'prototype-companions':
      return `${authority.prototypeDir}/companions/`
  }
}

function assertAuthority(authority: FileAuthority, relPath: string): void {
  const prefix = authorityPrefix(authority)
  if (authority.kind === 'profile-active') {
    if (relPath !== prefix) {
      throw new PathError('PATH_NOT_AUTHORISED', relPath, `Expected exactly "${prefix}"`)
    }
  } else if (!relPath.startsWith(prefix) || relPath.length <= prefix.length) {
    throw new PathError(
      'PATH_NOT_AUTHORISED',
      relPath,
      `Path is outside the authorised root "${prefix.replace(/\/$/, '')}"`,
    )
  }
}

function digestStream(absPath: string): Promise<string> {
  // Executor form: the frozen Wave-1 tsconfig pins lib ES2023, which has
  // no `Promise.withResolvers` typing.
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(absPath)
    stream.on('data', (chunk) => hash.update(chunk as Buffer))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export class PathResolver {
  /** Canonicalised absolute repository root. */
  readonly root: string
  private readonly cache = new Map<string, { dev: number; ino: number; size: number; mtimeMs: number; bytes: Buffer; sha256: string }>()

  constructor(root: string) {
    this.root = path.resolve(root)
  }

  join(relPath: string): string {
    return path.join(this.root, ...relPath.split('/'))
  }

  /**
   * Authorise and verify one repository file without reading its bytes:
   * existence checks (PRDs, companions) need syntax, authority, type, and
   * containment only.
   */
  async checkFile(authority: FileAuthority, relPath: string): Promise<FileSnapshot> {
    assertSafeRelativePath(relPath)
    assertAuthority(authority, relPath)
    return await this.statChecked(relPath)
  }

  /** Stat one repository file, enforcing regular-file and root containment. */
  private async statChecked(relPath: string): Promise<FileSnapshot> {
    assertSafeRelativePath(relPath)
    const absPath = this.join(relPath)
    let stats: Stats
    try {
      stats = await lstat(absPath)
    } catch {
      throw new PathError('SOURCE_NOT_FOUND', relPath, `File not found: ${relPath}`)
    }
    if (stats.isSymbolicLink()) {
      throw new PathError('PATH_NOT_AUTHORISED', relPath, 'Symbolic links are not accepted')
    }
    if (!stats.isFile()) {
      throw new PathError('PATH_NOT_AUTHORISED', relPath, 'Not a regular file')
    }
    const canonicalRoot = await realpath(this.root)
    let realPath: string
    try {
      realPath = await realpath(absPath)
    } catch {
      throw new PathError('SOURCE_NOT_FOUND', relPath, `File not found: ${relPath}`)
    }
    if (realPath !== canonicalRoot && !realPath.startsWith(canonicalRoot + path.sep)) {
      throw new PathError('PATH_NOT_AUTHORISED', relPath, 'Path resolves outside the repository root')
    }
    return {
      absPath: realPath,
      relPath,
      size: stats.size,
      dev: stats.dev,
      ino: stats.ino,
      sha256: await digestStream(realPath),
    }
  }

  /**
   * Resolve, authorise, and read one bounded repository file. Throws
   * `PathError` with an exact code and the safe relative path.
   */
  async resolveFile(authority: FileAuthority, relPath: string, maxBytes: number): Promise<ResolvedFile> {
    assertSafeRelativePath(relPath)
    assertAuthority(authority, relPath)
    return await this.readFileChecked(relPath, maxBytes)
  }

  /** Read a path already known to be repository-internal and authorised. */
  async readFileChecked(relPath: string, maxBytes: number): Promise<ResolvedFile> {
    assertSafeRelativePath(relPath)
    const absPath = this.join(relPath)
    let stats: Stats
    try {
      stats = await lstat(absPath)
    } catch {
      throw new PathError('SOURCE_NOT_FOUND', relPath, `File not found: ${relPath}`)
    }
    if (stats.isSymbolicLink()) {
      throw new PathError('PATH_NOT_AUTHORISED', relPath, 'Symbolic links are not accepted')
    }
    if (!stats.isFile()) {
      throw new PathError('PATH_NOT_AUTHORISED', relPath, 'Not a regular file')
    }
    const canonicalRoot = await realpath(this.root)
    let realPath: string
    try {
      realPath = await realpath(absPath)
    } catch {
      throw new PathError('SOURCE_NOT_FOUND', relPath, `File not found: ${relPath}`)
    }
    if (realPath !== canonicalRoot && !realPath.startsWith(canonicalRoot + path.sep)) {
      throw new PathError('PATH_NOT_AUTHORISED', relPath, 'Path resolves outside the repository root')
    }
    if (stats.size > maxBytes) {
      throw new PathError('FILE_TOO_LARGE', relPath, `File is ${stats.size} bytes; limit is ${maxBytes}`)
    }
    const cached = this.cache.get(realPath)
    if (
      cached &&
      cached.dev === stats.dev &&
      cached.ino === stats.ino &&
      cached.size === stats.size &&
      cached.mtimeMs === stats.mtimeMs
    ) {
      return {
        absPath: realPath,
        relPath,
        size: cached.size,
        dev: cached.dev,
        ino: cached.ino,
        sha256: cached.sha256,
        bytes: cached.bytes,
      }
    }
    let bytes: Buffer
    try {
      bytes = await readFile(realPath)
    } catch {
      throw new PathError('SOURCE_NOT_FOUND', relPath, `File not found: ${relPath}`)
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    this.cache.set(realPath, {
      dev: stats.dev,
      ino: stats.ino,
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      bytes,
      sha256,
    })
    return { absPath: realPath, relPath, size: stats.size, dev: stats.dev, ino: stats.ino, sha256, bytes }
  }

  /**
   * Walk one profile version directory, rejecting symlinks and special
   * files, and return every regular file with its streamed digest. No
   * bytes are retained; callers enforce count/size caps.
   */
  async listProfileVersionFiles(
    version: string,
  ): Promise<Array<FileSnapshot & { realPath: string }>> {
    const dirRel = `design-system/profiles/${version}`
    const canonicalDir = await realpath(this.join(dirRel))
    const out: Array<FileSnapshot & { realPath: string }> = []
    const walk = async (rel: string): Promise<void> => {
      let entries: Dirent[]
      try {
        entries = await readdir(this.join(rel), { withFileTypes: true })
      } catch {
        throw new PathError('SOURCE_NOT_FOUND', rel, `Directory not found: ${rel}`)
      }
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
        const childRel = `${rel}/${entry.name}`
        const childAbs = this.join(childRel)
        const stats = await lstat(childAbs)
        if (stats.isSymbolicLink()) {
          throw new PathError('PATH_NOT_AUTHORISED', childRel, 'Symbolic links are rejected inside immutable profiles')
        }
        if (stats.isDirectory()) {
          await walk(childRel)
        } else if (stats.isFile()) {
          const realPath = await realpath(childAbs)
          if (!realPath.startsWith(canonicalDir + path.sep)) {
            throw new PathError('PATH_NOT_AUTHORISED', childRel, 'Profile member resolves outside its version directory')
          }
          out.push({
            absPath: childAbs,
            realPath,
            relPath: childRel,
            size: stats.size,
            dev: stats.dev,
            ino: stats.ino,
            sha256: await digestStream(childAbs),
          })
        } else {
          throw new PathError('PATH_NOT_AUTHORISED', childRel, 'Special files are rejected inside immutable profiles')
        }
      }
    }
    await walk(dirRel)
    return out
  }

  /** Re-check a previously observed snapshot; used before committing a hand-off. */
  async recheckSnapshot(snapshot: FileSnapshot): Promise<boolean> {
    let stats: Stats
    try {
      stats = await stat(snapshot.absPath)
    } catch {
      return false
    }
    if (stats.dev !== snapshot.dev || stats.ino !== snapshot.ino || stats.size !== snapshot.size) {
      return false
    }
    return (await digestStream(snapshot.absPath)) === snapshot.sha256
  }

  /** Hash one authorised file through a bounded stream without caching bytes. */
  async digestFile(relPath: string): Promise<string> {
    assertSafeRelativePath(relPath)
    return await digestStream(this.join(relPath))
  }

  /** Stream one authorised file's raw bytes into an external hash without buffering. */
  async hashFileInto(relPath: string, hash: Hash): Promise<void> {
    await finished(createReadStream(this.join(relPath)).on('data', (chunk) => hash.update(chunk as Buffer)))
  }
}
