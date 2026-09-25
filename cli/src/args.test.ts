import { describe, expect, it } from 'vitest'
import { parseCli, UsageError } from './args.ts'

describe('parseCli', () => {
  it('parses init options with comma-separated lists', () => {
    expect(parseCli(['init', '--agents', 'claude-code, codex', '--capabilities', 'prototyping', '--content-root', 'docs', '--yes'])).toMatchObject({
      command: 'init',
      agents: ['claude-code', 'codex'],
      capabilities: ['prototyping'],
      contentRoot: 'docs',
      yes: true,
      dryRun: false,
    })
  })

  it.each([
    [['update'], /not available in this version yet/],
    [['install'], /Unknown command/],
    [['init', '--json'], /only supported by doctor/],
    [['doctor', '--yes'], /never writes/],
    [['doctor', '--agents', 'codex'], /only supported by init/],
    [['init', '--bogus'], /bogus/],
  ])('rejects %j', (argv, message) => {
    expect(() => parseCli(argv)).toThrow(UsageError)
    expect(() => parseCli(argv)).toThrow(message)
  })
})
