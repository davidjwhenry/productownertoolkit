import { describe, expect, it } from 'vitest'
import { comparisonScreenId } from './comparisonScreen'

const compact = ['overview', 'configure', 'review', 'success', 'paused'].map((id) => ({ id }))
const guided = ['overview', 'step-cadence', 'step-amount', 'step-roundups', 'review', 'success', 'paused'].map((id) => ({ id }))

describe('comparison screen navigation', () => {
  it('matches shared screens despite different step counts', () => {
    for (const id of ['overview', 'review', 'success', 'paused']) {
      expect(comparisonScreenId(id, compact, guided)).toBe(id)
      expect(comparisonScreenId(id, guided, compact)).toBe(id)
    }
  })

  it('opens the guided sequence when jumping to compact setup', () => {
    expect(comparisonScreenId('configure', compact, guided)).toBe('step-cadence')
  })

  it('keeps compact setup alongside each guided setup step', () => {
    for (const id of ['step-cadence', 'step-amount', 'step-roundups']) {
      expect(comparisonScreenId(id, guided, compact)).toBe('configure')
    }
  })

  it('matches scenario-only validation screens without a preceding shared screen', () => {
    expect(comparisonScreenId('configure', [{ id: 'configure' }], [{ id: 'step-amount' }])).toBe('step-amount')
  })

  it('does not navigate an absent comparison or an unknown screen', () => {
    expect(comparisonScreenId('configure', compact, [])).toBeNull()
    expect(comparisonScreenId('unknown', compact, guided)).toBeNull()
  })
})
