import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupTempDirs, tempDir } from '../test/helpers.ts'
import { checksum, isSafeRelativePath, normalise, Target, UnsafePathError, writeFileAtomic } from './fsx.ts'

afterEach(cleanupTempDirs)

describe('isSafeRelativePath', () => {
  it.each(['a', 'a/b.md', '.claude/skills/x/SKILL.md', 'product/..x'])('accepts %s', (rel) => {
    expect(isSafeRelativePath(rel)).toBe(true)
  })

  it.each(['', '/etc/passwd', 'C:/x', 'a/../b', '../a', './a', 'a//b', 'a/', 'a\\b', 'a\0b'])('rejects %j', (rel) => {
    expect(isSafeRelativePath(rel)).toBe(false)
  })
})

describe('checksum', () => {
  it('ignores CRLF versus LF in text', () => {
    expect(checksum(Buffer.from('a\r\nb\r\n'))).toBe(checksum(Buffer.from('a\nb\n')))
    expect(normalise(Buffer.from('a\r\nb'))).toEqual(Buffer.from('a\nb'))
  })

  it('hashes binary bytes exactly', () => {
    const binary = Buffer.from([0, 13, 10, 1])
    expect(normalise(binary)).toBe(binary)
    expect(checksum(binary)).not.toBe(checksum(Buffer.from([0, 10, 1])))
  })
})

describe('Target.inspect', () => {
  it('classifies files, directories, and missing paths', () => {
    const dir = tempDir()
    dir.write('a/b.txt', 'x')
    const target = Target.open(dir.root)
    expect(target.inspect('a')).toEqual({ kind: 'directory' })
    expect(target.inspect('a/b.txt')).toEqual({ kind: 'file' })
    expect(target.inspect('a/c/d')).toEqual({ kind: 'missing' })
    expect(target.inspect('a/b.txt/c')).toEqual({ kind: 'not-directory', at: 'a/b.txt' })
  })

  it('stops at a symlink anywhere on the path', () => {
    const dir = tempDir()
    const outside = tempDir()
    dir.symlink('product', outside.root)
    const target = Target.open(dir.root)
    expect(target.inspect('product/context/x.md')).toEqual({ kind: 'symlink', at: 'product' })
    expect(target.read('product/x')).toBeUndefined()
  })

  it('reports a case-only name difference', () => {
    const dir = tempDir()
    dir.mkdir('Product')
    expect(Target.open(dir.root).inspect('product/context')).toEqual({ kind: 'case-mismatch', at: 'Product' })
  })

  it('rejects traversal', () => {
    const target = Target.open(tempDir().root)
    expect(() => target.inspect('../x')).toThrow(UnsafePathError)
    expect(() => target.abs('a/../../x')).toThrow(UnsafePathError)
  })

  it('opens a target reached through a symlink at its canonical path', () => {
    const dir = tempDir()
    const link = path.join(tempDir().root, 'link')
    fs.symlinkSync(dir.root, link, process.platform === 'win32' ? 'junction' : 'dir')
    expect(Target.open(link).root).toBe(dir.root)
  })
})

describe('writeFileAtomic', () => {
  it('creates parents, writes, and leaves no temporary file', () => {
    const dir = tempDir()
    const created = writeFileAtomic(Target.open(dir.root), 'a/b/c.txt', Buffer.from('hello'))
    expect(dir.read('a/b/c.txt')).toBe('hello')
    expect(dir.files()).toEqual(['a/b/c.txt'])
    expect(created).toEqual([path.join(dir.root, 'a', 'b'), path.join(dir.root, 'a')])
  })
})
