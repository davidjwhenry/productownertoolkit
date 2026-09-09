import { describe, expect, it } from 'vitest'
import { SURFACE_PRESETS, surfaceFrameSize, zoomScale } from './surfaces'

describe('surface presets', () => {
  it('defines exactly the two contracted surfaces with fixed dimensions', () => {
    expect(Object.keys(SURFACE_PRESETS).sort()).toEqual(['desktop', 'ios'])
    const desktop = SURFACE_PRESETS.desktop
    expect(desktop.content).toEqual({ width: 1440, height: 900 })
    expect(desktop.chrome).toEqual({ kind: 'desktop', titleBarHeight: 42, outerRadius: 12 })
    expect(desktop.safeArea).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    const ios = SURFACE_PRESETS.ios
    expect(ios.content).toEqual({ width: 393, height: 852 })
    expect(ios.chrome).toMatchObject({ kind: 'ios', bezel: 12, outerRadius: 54, island: { width: 126, height: 37 }, homeIndicator: { width: 134, height: 5 } })
    expect(ios.safeArea).toEqual({ top: 59, right: 0, bottom: 34, left: 0 })
  })

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
