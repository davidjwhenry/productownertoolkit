import { describe, expect, it } from 'vitest'
import { desiredFiles, loadBundle } from './bundle.ts'
import { globToRegExp } from './glob.ts'

const bundle = loadBundle()
const installed = { content: 'product', toolkit: '.product-owner-toolkit/guides' }

describe('globToRegExp', () => {
  it.each([
    ['src/**/*.{ts,tsx,css}', 'src/a.ts', true],
    ['src/**/*.{ts,tsx,css}', 'src/x/y/b.tsx', true],
    ['src/**/*.{ts,tsx,css}', 'src/a.json', false],
    ['schemas/*.json', 'schemas/a.json', true],
    ['schemas/*.json', 'schemas/x/a.json', false],
    ['node_modules/**', 'node_modules/a/b', true],
    ['src/testing/**', 'src/testing/x.ts', true],
  ])('%s matches %s: %s', (glob, rel, expected) => {
    expect(globToRegExp(glob).test(rel)).toBe(expected)
  })
})

describe('desiredFiles', () => {
  it('installs core skills once per needed skill folder, with rendered paths', () => {
    const files = desiredFiles(bundle, { skillDirectories: ['.claude/skills', '.agents/skills'], capabilities: [], roots: installed })
    const skill = files.filter((f) => f.path.endsWith('bootstrap-context/SKILL.md')).map((f) => f.path)
    expect(skill).toEqual(['.claude/skills/bootstrap-context/SKILL.md', '.agents/skills/bootstrap-context/SKILL.md'])
    const text = files.find((f) => f.path === '.claude/skills/bootstrap-context/SKILL.md')!.contents.toString('utf8')
    expect(text).toContain('product/context/company-context.md')
    expect(text).not.toContain('{content}')
    expect(files.some((f) => f.skill === 'prototype-builder')).toBe(false)
  })

  it('maps managed guides and seeds under their roots', () => {
    const files = desiredFiles(bundle, { skillDirectories: ['.agents/skills'], capabilities: [], roots: installed })
    expect(files.find((f) => f.path === '.product-owner-toolkit/guides/mcp-config/firecrawl.md')?.ownership).toBe('managed')
    expect(files.find((f) => f.path === 'product/context/company-context.md')?.ownership).toBe('seed')
  })

  it('installs the playground runtime without tests, dependencies, or build output, and treats the lockfile as seed', () => {
    const files = desiredFiles(bundle, { skillDirectories: ['.agents/skills'], capabilities: ['prototyping'], roots: installed })
    const runtime = files.filter((f) => f.path.startsWith('prototype-playground/'))
    expect(runtime.find((f) => f.path === 'prototype-playground/src/workspace.ts')?.ownership).toBe('managed')
    expect(runtime.find((f) => f.path === 'prototype-playground/package-lock.json')?.ownership).toBe('seed')
    expect(runtime.some((f) => /\.test\.ts$|\/node_modules\/|\/dist\/|\/e2e\/|src\/testing\//.test(f.path))).toBe(false)
  })

  it('expands directory mappings for examples', () => {
    const files = desiredFiles(bundle, { skillDirectories: ['.agents/skills'], capabilities: ['examples'], roots: installed })
    expect(files.some((f) => f.path.startsWith('product/examples/example-feature/prototypes/'))).toBe(true)
  })
})
