/**
 * `PrototypePreview` — mounts exactly one sandboxed iframe per variant
 * load. The iframe carries `sandbox="allow-scripts"`,
 * `referrerpolicy="no-referrer"`, an explicit `title`, and an empty
 * Permissions Policy `allow`; `allow-same-origin`, form submission,
 * pop-ups, downloads, and top navigation are never granted. Every
 * Variant, Surface, Scenario, or theme change recreates the iframe from
 * deterministic state. Inactive variants are unmounted by the caller.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { PrototypeBridgeErrorCode, PrototypeContext, SurfaceId } from '../contracts'
import { buildSandboxDocument } from './sandbox'
import { validateBridgeMessage } from './bridge'
import { SURFACE_PRESETS, surfaceFrameSize, zoomScale, type ZoomMode } from './surfaces'

export type PreviewStatus =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'timeout' }
  | { kind: 'error'; code: PrototypeBridgeErrorCode }
  | { kind: 'unavailable' }

export type PrototypePreviewProps = {
  /** Promise resolving to the repository variant HTML. */
  source: Promise<string>
  prototypeId: string
  variantId: string
  surfaceId: SurfaceId
  scenarioId: string
  themeId: string
  zoom: ZoomMode
  /** Extra remount trigger (comparison slot, manual reload). */
  reloadKey?: number
  onStatus?: (status: PreviewStatus) => void
}

const READY_TIMEOUT_MS = 3000

function makeChannelId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function PrototypePreview(props: PrototypePreviewProps): JSX.Element {
  const { source, prototypeId, variantId, surfaceId, scenarioId, themeId, zoom, reloadKey = 0, onStatus } = props
  const [status, setStatus] = useState<PreviewStatus>({ kind: 'loading' })
  const [html, setHtml] = useState<string | null>(null)
  const [loadFailure, setLoadFailure] = useState(false)
  const [manualReload, setManualReload] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const wrapNodeRef = useRef<HTMLDivElement | null>(null)
  const [container, setContainer] = useState<{ width: number; height: number } | null>(null)

  // Fit recomputes on container resize without changing the selected surface.
  useEffect(() => {
    const node = wrapNodeRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const measure = (): void => {
      setContainer((previous) => {
        const next = { width: node.clientWidth, height: node.clientHeight }
        return previous && previous.width === next.width && previous.height === next.height ? previous : next
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [html])

  const effectiveReloadKey = reloadKey + manualReload
  const channelId = useMemo(() => makeChannelId(), [prototypeId, variantId, surfaceId, scenarioId, themeId, effectiveReloadKey])
  const context: PrototypeContext = useMemo(
    () => ({ protocolVersion: 1, channelId, prototypeId, variantId, surfaceId, scenarioId, themeId }),
    [channelId, prototypeId, variantId, surfaceId, scenarioId, themeId],
  )
  const sandboxDocument = useMemo(() => {
    if (html === null) return null
    return buildSandboxDocument(html, context)
  }, [html, context])

  const update = useCallback(
    (next: PreviewStatus) => {
      setStatus(next)
      onStatus?.(next)
    },
    [onStatus],
  )

  // Lazy HTML load: a failure shows Preview unavailable without crashing the shell.
  useEffect(() => {
    let cancelled = false
    setHtml(null)
    setLoadFailure(false)
    update({ kind: 'loading' })
    source.then(
      (loaded) => {
        if (!cancelled) setHtml(loaded)
      },
      () => {
        if (!cancelled) {
          setLoadFailure(true)
          update({ kind: 'unavailable' })
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [source, update, channelId])

  // Bridge: hostile-message filtering, single ready, at most one error.
  const acceptedReady = useRef(false)
  const acceptedError = useRef(false)
  useEffect(() => {
    acceptedReady.current = false
    acceptedError.current = false
    const handler = (event: MessageEvent): void => {
      const acceptance = validateBridgeMessage(
        { source: event.source, origin: event.origin, data: event.data },
        { source: iframeRef.current?.contentWindow ?? null, channelId },
      )
      if (acceptance.kind === 'reject') return
      if (acceptance.kind === 'ready') {
        if (acceptedReady.current) return
        acceptedReady.current = true
        update({ kind: 'ready' })
        return
      }
      if (acceptedError.current) return
      acceptedError.current = true
      update({ kind: 'error', code: acceptance.code })
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [channelId, update])

  // Ready timeout: retain the iframe, show fixed parent-owned copy.
  useEffect(() => {
    if (status.kind !== 'loading' || sandboxDocument === null) return
    const timer = window.setTimeout(() => {
      if (status.kind === 'loading') update({ kind: 'timeout' })
    }, READY_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [status, sandboxDocument, update])

  // Unexpected second iframe load after ready is UNEXPECTED_NAVIGATION.
  const loadCount = useRef(0)
  const onLoad = useCallback(() => {
    loadCount.current += 1
    if (loadCount.current > 1 && acceptedReady.current) {
      update({ kind: 'error', code: 'UNEXPECTED_NAVIGATION' })
    }
  }, [update])
  useEffect(() => {
    loadCount.current = 0
  }, [channelId])

  const preset = SURFACE_PRESETS[surfaceId]
  const frame = surfaceFrameSize(preset)
  const scale = container ? zoomScale(zoom, container, frame) : 1
  // The sizer carries the *scaled* footprint: CSS transforms paint smaller
  // but keep the logical layout box, so an unscaled 876 px-tall iOS frame
  // would overflow and scroll the canvas behind the device. Sizing the
  // sizer to the scaled dimensions keeps the canvas itself static; only
  // deliberate over-zoom pans inside the wrap.
  const scaled = { width: Math.round(frame.width * scale), height: Math.round(frame.height * scale) }

  return (
    <div className="preview-stage" data-status={status.kind}>
      <div className="preview-frame-wrap" ref={wrapNodeRef}>
        {sandboxDocument !== null ? (
          <div className="preview-frame-sizer" style={{ width: scaled.width, height: scaled.height }}>
            <div className={`preview-frame preview-frame-${preset.chrome.kind}`} style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}>
            {preset.chrome.kind === 'desktop' ? (
              <div className="preview-chrome-titlebar" aria-hidden="true">
                <span className="preview-chrome-dots" />
                <span className="preview-chrome-title">{`${prototypeId} — ${variantId}`}</span>
              </div>
            ) : (
              <div className="preview-chrome-island" aria-hidden="true" />
            )}
            <iframe
              key={channelId}
              ref={iframeRef}
              className="preview-iframe"
              title={`Prototype ${prototypeId}, variant ${variantId}, surface ${surfaceId}, scenario ${scenarioId}, theme ${themeId}`}
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              allow=""
              srcDoc={sandboxDocument}
              onLoad={onLoad}
              style={{ width: preset.content.width, height: preset.content.height }}
            />
            {preset.chrome.kind === 'ios' ? <div className="preview-chrome-home" aria-hidden="true" /> : null}
            </div>
          </div>
        ) : loadFailure ? (
          <p className="preview-message" role="status">Preview unavailable</p>
        ) : (
          <p className="preview-message" role="status">Loading preview…</p>
        )}
      </div>
      {status.kind === 'timeout' ? (
        <div className="preview-banner" role="alert">
          <p>Preview did not connect</p>
          <button type="button" onClick={() => setManualReload((n) => n + 1)}>Reload preview</button>
        </div>
      ) : null}
      {status.kind === 'error' ? (
        <div className="preview-banner" role="alert">
          <p>Prototype error</p>
          <button type="button" onClick={() => setManualReload((n) => n + 1)}>Reload preview</button>
        </div>
      ) : null}
    </div>
  )
}
