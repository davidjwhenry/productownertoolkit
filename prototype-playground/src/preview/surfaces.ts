/**
 * The two explicit device surfaces. Preset values are fixed by contract:
 * `desktop` renders a 1440 × 900 content viewport inside a 42 px title bar
 * with a 12 px outer radius; `ios` renders a 393 × 852 portrait viewport
 * inside a 12 px black bezel with a 54 px outer radius, a 126 × 37 top
 * island, and a 134 × 5 home indicator; safe areas are 59 px top and 34 px
 * bottom.
 */
import type { SurfaceId } from '../contracts'

export type SurfaceChrome =
  | {
      kind: 'desktop'
      /** Neutral browser-style title bar height above the content viewport. */
      titleBarHeight: 42
      /** Outer window radius. */
      outerRadius: 12
    }
  | {
      kind: 'ios'
      /** Black bezel thickness around the content viewport. */
      bezel: 12
      outerRadius: 54
      island: { width: 126; height: 37 }
      homeIndicator: { width: 134; height: 5 }
    }

export type SurfacePreset = {
  id: SurfaceId
  label: string
  /** Logical content viewport the iframe occupies. */
  content: { width: number; height: number }
  safeArea: { top: number; right: number; bottom: number; left: number }
  chrome: SurfaceChrome
}

export const SURFACE_PRESETS: Record<SurfaceId, SurfacePreset> = {
  desktop: {
    id: 'desktop',
    label: 'Desktop',
    content: { width: 1440, height: 900 },
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    chrome: { kind: 'desktop', titleBarHeight: 42, outerRadius: 12 },
  },
  ios: {
    id: 'ios',
    label: 'iOS',
    content: { width: 393, height: 852 },
    safeArea: { top: 59, right: 0, bottom: 34, left: 0 },
    chrome: {
      kind: 'ios',
      bezel: 12,
      outerRadius: 54,
      island: { width: 126, height: 37 },
      homeIndicator: { width: 134, height: 5 },
    },
  },
}

/** Complete outer frame size including chrome, preserving logical iframe dimensions. */
export function surfaceFrameSize(preset: SurfacePreset): { width: number; height: number } {
  if (preset.chrome.kind === 'desktop') {
    return { width: preset.content.width, height: preset.content.height + preset.chrome.titleBarHeight }
  }
  return {
    width: preset.content.width + preset.chrome.bezel * 2,
    height: preset.content.height + preset.chrome.bezel * 2,
  }
}

export type ZoomMode = 'fit' | '50' | '75' | '100'

export const ZOOM_MODES: ZoomMode[] = ['fit', '50', '75', '100']

/** Compute the scale factor for a zoom mode inside a container. */
export function zoomScale(mode: ZoomMode, container: { width: number; height: number }, frame: { width: number; height: number }): number {
  if (mode !== 'fit') return Number(mode) / 100
  if (container.width <= 0 || container.height <= 0) return 1
  const scale = Math.min(container.width / frame.width, container.height / frame.height)
  // Allow moderate upscaling so portrait devices fill tall canvases;
  // cap at 1.5× to avoid oversized rendering on very large monitors.
  return Math.min(1.5, Math.max(0.05, scale))
}
