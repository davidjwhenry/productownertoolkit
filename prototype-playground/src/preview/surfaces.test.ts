import { describe, expect, it } from 'vitest'
import { SURFACE_PRESETS, surfaceFrameSize, zoomScale } from './surfaces'

describe('surface presets', () => {
  it('frames include chrome while preserving logical iframe dimensions', () => {
    expect(surfaceFrameSize(SURFACE_PRESETS.desktop)).toEqual({ width: 1440, height: 942 })
    expect(surfaceFrameSize(SURFACE_PRESETS.ios)).toEqual({ width: 417, height: 876 })
  })

  it('computes zoom scales, with fit capped at 1.5x', () => {
    const frame = { width: 1440, height: 942 }
    expect(zoomScale('100', { width: 2000, height: 2000 }, frame)).toBe(1)
    expect(zoomScale('75', { width: 2000, height: 2000 }, frame)).toBe(0.75)
    expect(zoomScale('50', { width: 2000, height: 2000 }, frame)).toBe(0.5)
    expect(zoomScale('fit', { width: 720, height: 471 }, frame)).toBeCloseTo(0.5)
    expect(zoomScale('fit', { width: 4000, height: 4000 }, frame)).toBe(1.5)
    expect(zoomScale('fit', { width: 0, height: 0 }, frame)).toBe(1)
    // iOS frame fills a tall canvas instead of staying at 1×
    const iosFrame = { width: 417, height: 876 }
    expect(zoomScale('fit', { width: 1500, height: 1400 }, iosFrame)).toBeCloseTo(1.5)
  })
})
