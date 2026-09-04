/**
 * Parent-side bridge validation. The parent treats every `message` event
 * as hostile: it requires the current iframe's `event.source`, the opaque
 * origin `null`, exact keys and types, protocol version 1, and the
 * cryptographically random per-load channel; extra keys and stale
 * channels are rejected. `ready` is accepted once and at most one error
 * is accepted per load.
 */
import type { PrototypeBridgeErrorCode, PrototypeBridgeMessage } from '../contracts'
import { PROTOTYPE_BRIDGE_PROTOCOL_VERSION } from '../contracts'

export type IncomingBridgeEvent = {
  source: unknown
  origin: string
  data: unknown
}

export type BridgeExpectation = {
  /** `contentWindow` of the one iframe this listener currently serves. */
  source: unknown
  /** Per-load cryptographically random channel id. */
  channelId: string
}

export type BridgeAcceptance =
  | { kind: 'ready' }
  | { kind: 'error'; code: PrototypeBridgeErrorCode }
  | { kind: 'reject'; reason: string }

const READY_KEYS = ['type', 'protocolVersion', 'channelId']
const ERROR_KEYS = ['type', 'protocolVersion', 'channelId', 'code']
const ERROR_CODES: PrototypeBridgeErrorCode[] = ['RUNTIME_INITIALISATION_FAILED', 'INVALID_DECLARATIVE_TARGET', 'UNEXPECTED_NAVIGATION']

/** Validate one incoming event against the per-load expectation. */
export function validateBridgeMessage(event: IncomingBridgeEvent, expectation: BridgeExpectation): BridgeAcceptance {
  if (event.source !== expectation.source) {
    return { kind: 'reject', reason: 'source' }
  }
  if (event.origin !== 'null') {
    return { kind: 'reject', reason: 'origin' }
  }
  if (typeof event.data !== 'object' || event.data === null) {
    return { kind: 'reject', reason: 'data-type' }
  }
  const data = event.data as Record<string, unknown>
  const keys = Object.keys(data).sort()
  const isReady = keys.join(',') === READY_KEYS.slice().sort().join(',') && data.type === 'prototype:ready'
  const isError = keys.join(',') === ERROR_KEYS.slice().sort().join(',') && data.type === 'prototype:error'
  if (!isReady && !isError) {
    return { kind: 'reject', reason: 'shape' }
  }
  if (data.protocolVersion !== PROTOTYPE_BRIDGE_PROTOCOL_VERSION) {
    return { kind: 'reject', reason: 'protocol' }
  }
  if (data.channelId !== expectation.channelId || typeof data.channelId !== 'string') {
    return { kind: 'reject', reason: 'channel' }
  }
  if (isReady) {
    return { kind: 'ready' }
  }
  const code = data.code
  if (typeof code !== 'string' || !ERROR_CODES.includes(code as PrototypeBridgeErrorCode)) {
    return { kind: 'reject', reason: 'code' }
  }
  return { kind: 'error', code: code as PrototypeBridgeErrorCode }
}
