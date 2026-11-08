import { describe, expect, it } from 'vitest'
import type { Amendment } from '../contracts'
import { buildAmendmentsBrief } from './amendmentsBrief'

const record = {
  id: 'savings-automation', title: 'Savings automation', origin: 'example' as const,
  manifestPath: 'examples/feature/prototypes/savings-automation/prototype.json',
  source: { prd: 'examples/feature/prd/savings.md', requirementIds: ['AF.2'] },
  designSystem: { id: 'default', version: 'v002', fingerprint: 'sha256:fixture' as const, currentness: 'active' as const },
}
const amendment: Amendment = {
  id: 'am-001', title: 'Explain the daily cap', note: 'Show the threshold before confirmation.\nKeep the existing amount.',
  screenId: 'step-amount', requirementId: 'AF.2', author: 'Reviewer', date: '2026-11-08', status: 'open',
  selection: { variantId: 'guided-trust', surfaceId: 'ios', scenarioId: 'validation-error', themeId: 'dark', screenId: 'step-amount' },
}

describe('agent amendment brief', () => {
  it('includes actionable feedback, local sources, and the exact review context', () => {
    const brief = buildAmendmentsBrief(record, [amendment], 'http://127.0.0.1:5173/')
    expect(brief).toContain('Review and address 1 open amendment')
    expect(brief).toContain('Explain the daily cap (am-001)')
    expect(brief).toContain('> Show the threshold before confirmation.\n> Keep the existing amount.')
    expect(brief).toContain(record.manifestPath)
    expect(brief).toContain('examples/feature/prototypes/savings-automation/amendments.json')
    expect(brief).toContain(record.source.prd)
    expect(brief).toContain('default@v002')
    const link = brief.match(/Review link: (.+)/)![1]!
    const params = new URL(link).searchParams
    expect(Object.fromEntries(params)).toMatchObject({ prototype: record.id, variant: 'guided-trust', scenario: 'validation-error', screen: 'step-amount', surface: 'ios', theme: 'dark', examples: '1' })
    expect(params.has('compare')).toBe(false)
  })

  it('excludes resolved and dismissed suggestions from the work to do', () => {
    const brief = buildAmendmentsBrief(record, [amendment, { ...amendment, id: 'done', title: 'Already fixed', status: 'resolved' }, { ...amendment, id: 'rejected', title: 'Rejected suggestion', status: 'dismissed' }], 'http://localhost/')
    expect(brief).toContain('1 open amendment')
    expect(brief).not.toContain('Already fixed')
    expect(brief).not.toContain('Rejected suggestion')
    expect(brief).toContain('leave amendment statuses unchanged')
  })

  it('handles an empty hand-off and offline review links', () => {
    expect(buildAmendmentsBrief(record, [], 'file:///tmp/handoff/index.html')).toContain('No open amendments.')
    expect(buildAmendmentsBrief(record, [amendment], 'file:///tmp/handoff/index.html')).toContain('file:///tmp/handoff/index.html?prototype=')
  })
})
