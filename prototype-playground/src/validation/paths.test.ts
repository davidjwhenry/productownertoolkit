import { describe, expect, it } from 'vitest'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PathError, PathResolver, assertSafeRelativePath } from './paths'
import { makeFixtureRepo } from '../testing/make-fixture-repo'

function expectPathError(fn: () => unknown): PathError {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(PathError)
    return e as PathError
  }
  throw new Error('expected assertSafeRelativePath to throw')
}

describe('assertSafeRelativePath', () => {
  it('accepts ordinary POSIX relative paths', () => {
    expect(() => assertSafeRelativePath('examples/a/prototypes/b/prototype.json')).not.toThrow()
    expect(() => assertSafeRelativePath('design-system/profiles/ACTIVE')).not.toThrow()
  })

  it('rejects escapes, absolute forms, and control characters', () => {
    for (const bad of ['', '/absolute', '../escape', 'a/../b', 'a//b', 'a\\b', 'C:/x', '//unc/server', 'http://example.com/x', 'a\u0000b']) {
      const err = expectPathError(() => assertSafeRelativePath(bad))
      expect(err.code).toBe('PATH_NOT_AUTHORISED')
    }
  })
})

describe('PathResolver', () => {
  it('enforces field-specific authorities', async () => {
    const repo = await makeFixtureRepo()
    try {
      const resolver = new PathResolver(repo.root)
      // Correct authority succeeds.
      await resolver.checkFile({ kind: 'feature-prd', featureDir: 'examples/demo-feature' }, 'examples/demo-feature/prd/demo-feature-prd.md')
      // Cross-feature PRD is unauthorised.
      await expect(
        resolver.checkFile({ kind: 'feature-prd', featureDir: 'examples/other-feature' }, 'examples/demo-feature/prd/demo-feature-prd.md'),
      ).rejects.toMatchObject({ code: 'PATH_NOT_AUTHORISED' })
      // Variant entry outside its prototype directory is unauthorised.
      await expect(
        resolver.checkFile({ kind: 'prototype-variants', prototypeDir: 'examples/demo-feature/prototypes/demo' }, 'examples/demo-feature/prd/demo-feature-prd.md'),
      ).rejects.toMatchObject({ code: 'PATH_NOT_AUTHORISED' })
      // Profile artefacts must stay inside their vNNN.
      await expect(
        resolver.checkFile({ kind: 'profile-version', version: 'v001' }, 'design-system/example.pen'),
      ).rejects.toMatchObject({ code: 'PATH_NOT_AUTHORISED' })
    } finally {
      await repo.cleanup()
    }
  })

  it('reports missing files as SOURCE_NOT_FOUND', async () => {
    const repo = await makeFixtureRepo()
    try {
      const resolver = new PathResolver(repo.root)
      await expect(
        resolver.checkFile({ kind: 'feature-prd', featureDir: 'examples/demo-feature' }, 'examples/demo-feature/prd/absent.md'),
      ).rejects.toMatchObject({ code: 'SOURCE_NOT_FOUND' })
    } finally {
      await repo.cleanup()
    }
  })

  it('rejects symlinks and directories', async () => {
    const repo = await makeFixtureRepo()
    try {
      const resolver = new PathResolver(repo.root)
      await repo.link('examples/demo-feature/prd/link.md', path.join(repo.root, 'examples/demo-feature/prd/demo-feature-prd.md'))
      await expect(
        resolver.checkFile({ kind: 'feature-prd', featureDir: 'examples/demo-feature' }, 'examples/demo-feature/prd/link.md'),
      ).rejects.toMatchObject({ code: 'PATH_NOT_AUTHORISED' })
      await expect(
        resolver.checkFile({ kind: 'feature-prd', featureDir: 'examples/demo-feature' }, 'examples/demo-feature/prd'),
      ).rejects.toMatchObject({ code: 'PATH_NOT_AUTHORISED' })
    } finally {
      await repo.cleanup()
    }
  })

  it('rejects files that resolve outside the repository root', async () => {
    const outside = await makeFixtureRepo()
    const inside = await makeFixtureRepo()
    try {
      const resolver = new PathResolver(inside.root)
      // A directory symlink escaping the root: readFileChecked realpath check.
      await outside.write('design-system/escape.css', 'x')
      await inside.link('design-system/profiles/v001/escape.css', path.join(outside.root, 'design-system/escape.css'))
      await expect(resolver.listProfileVersionFiles('v001')).rejects.toMatchObject({ code: 'PATH_NOT_AUTHORISED' })
    } finally {
      await outside.cleanup()
      await inside.cleanup()
    }
  })

  it('enforces byte caps and caches bounded reads', async () => {
    const repo = await makeFixtureRepo()
    try {
      const resolver = new PathResolver(repo.root)
      await expect(
        resolver.readFileChecked('examples/demo-feature/prototypes/demo/prototype.json', 8),
      ).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' })
      const first = await resolver.readFileChecked('examples/demo-feature/prototypes/demo/prototype.json', 1024 * 1024)
      const second = await resolver.readFileChecked('examples/demo-feature/prototypes/demo/prototype.json', 1024 * 1024)
      expect(second.sha256).toBe(first.sha256)
      expect(second.bytes.equals(first.bytes)).toBe(true)
    } finally {
      await repo.cleanup()
    }
  })

  it('detects snapshot drift', async () => {
    const repo = await makeFixtureRepo()
    try {
      const resolver = new PathResolver(repo.root)
      const snapshot = await resolver.checkFile({ kind: 'design-system' }, 'design-system/example.pen')
      expect(await resolver.recheckSnapshot(snapshot)).toBe(true)
      await repo.write('design-system/example.pen', 'changed bytes')
      expect(await resolver.recheckSnapshot(snapshot)).toBe(false)
    } finally {
      await repo.cleanup()
    }
  })

  it('rejects special files inside profile versions', async () => {
    const repo = await makeFixtureRepo()
    try {
      const resolver = new PathResolver(repo.root)
      const fifo = path.join(repo.root, 'design-system/profiles/v001/pipe')
      const { execFileSync } = await import('node:child_process')
      execFileSync('mkfifo', [fifo])
      await expect(resolver.listProfileVersionFiles('v001')).rejects.toMatchObject({ code: 'PATH_NOT_AUTHORISED' })
    } finally {
      await repo.cleanup()
    }
  })

  it('walks nested profile members with the same digest as raw bytes', async () => {
    const repo = await makeFixtureRepo()
    try {
      const resolver = new PathResolver(repo.root)
      await mkdir(path.join(repo.root, 'design-system/assets'), { recursive: true })
      await writeFile(path.join(repo.root, 'design-system/assets/logo.svg'), '<svg/>')
      await repo.link('design-system/profiles/v001/assets', path.join(repo.root, 'design-system/assets'))
      await expect(resolver.listProfileVersionFiles('v001')).rejects.toMatchObject({ code: 'PATH_NOT_AUTHORISED' })
    } finally {
      await repo.cleanup()
    }
  })
})
