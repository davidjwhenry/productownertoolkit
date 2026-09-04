import { describe, expect, it } from 'vitest'
import { validateBridgeMessage } from './bridge'

const SOURCE: unknown = { postMessage: () => undefined }
const CHANNEL = '0123456789abcdef0123456789abcdef'
const EXPECTATION = { source: SOURCE, channelId: CHANNEL }

function event(data: unknown, overrides: Partial<{ source: unknown; origin: string }> = {}): { source: unknown; origin: string; data: unknown } {
  return { source: SOURCE, origin: 'null', data, ...overrides }
}

describe('validateBridgeMessage', () => {
  it('accepts a well-formed ready message', () => {
    expect(validateBridgeMessage(event({ type: 'prototype:ready', protocolVersion: 1, channelId: CHANNEL }), EXPECTATION)).toEqual({ kind: 'ready' })
  })

  it('accepts a well-formed error message with a known code', () => {
    expect(
      validateBridgeMessage(event({ type: 'prototype:error', protocolVersion: 1, channelId: CHANNEL, code: 'UNEXPECTED_NAVIGATION' }), EXPECTATION),
    ).toEqual({ kind: 'error', code: 'UNEXPECTED_NAVIGATION' })
  })

  it('rejects foreign sources, non-opaque origins, and non-object data', () => {
    expect(validateBridgeMessage(event({ type: 'prototype:ready', protocolVersion: 1, channelId: CHANNEL }, { source: {} }), EXPECTATION).kind).toBe('reject')
    expect(validateBridgeMessage(event({ type: 'prototype:ready', protocolVersion: 1, channelId: CHANNEL }, { origin: 'https://evil.example' }), EXPECTATION).kind).toBe('reject')
    expect(validateBridgeMessage(event('prototype:ready'), EXPECTATION).kind).toBe('reject')
    expect(validateBridgeMessage(event(null), EXPECTATION).kind).toBe('reject')
  })

  it('rejects extra keys, wrong types, wrong protocol, and stale channels', () => {
    expect(validateBridgeMessage(event({ type: 'prototype:ready', protocolVersion: 1, channelId: CHANNEL, extra: 1 }), EXPECTATION).kind).toBe('reject')
    expect(validateBridgeMessage(event({ type: 'prototype:ready', protocolVersion: 1, channelId: 42 }), EXPECTATION).kind).toBe('reject')
    expect(validateBridgeMessage(event({ type: 'prototype:ready', protocolVersion: 2, channelId: CHANNEL }), EXPECTATION).kind).toBe('reject')
    expect(validateBridgeMessage(event({ type: 'prototype:ready', protocolVersion: 1, channelId: 'stale-channel' }), EXPECTATION).kind).toBe('reject')
    expect(validateBridgeMessage(event({ protocolVersion: 1, channelId: CHANNEL }), EXPECTATION).kind).toBe('reject')
  })

  it('rejects unknown error codes', () => {
    expect(validateBridgeMessage(event({ type: 'prototype:error', protocolVersion: 1, channelId: CHANNEL, code: 'SOMETHING_ELSE' }), EXPECTATION).kind).toBe('reject')
    expect(validateBridgeMessage(event({ type: 'prototype:error', protocolVersion: 1, channelId: CHANNEL, code: 7 }), EXPECTATION).kind).toBe('reject')
  })

  it('rejects forged message types that reuse the shape', () => {
    expect(validateBridgeMessage(event({ type: 'prototype:navigate', protocolVersion: 1, channelId: CHANNEL }), EXPECTATION).kind).toBe('reject')
  })
})
