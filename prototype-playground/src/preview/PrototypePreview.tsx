/**
 * `PrototypePreview` — mounts exactly one sandboxed iframe per variant
 * load. The iframe carries `sandbox="allow-scripts"`,
 * `referrerpolicy="no-referrer"`, an explicit `title`, and an empty
 * Permissions Policy `allow`; `allow-same-origin`, form submission,
 * pop-ups, downloads, and top navigation are never granted. Every
 * Variant, Surface, Scenario, or theme change recreates the iframe from
 * deterministic state. Inactive variants are unmounted by the caller.
 *
 * Protocol v2: the context carries the scenario's screen registry and an
 * optional `startScreen`; `goto` sends a validated parent-to-child
 * navigation command and `onScreen` reports every screen the runtime
 * shows so the host can keep its position state in sync.
 */
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type JSX, type Ref } from 'react'
import type { DeviceChrome, PrototypeBridgeErrorCode, PrototypeContext, ScreenRuntimeDeclaration, SurfaceId } from '../contracts'
import { buildSandboxDocument } from './sandbox'
import { buildGotoMessage, validateBridgeMessage } from './bridge'
import { surfaceFrameSize, surfacePreset, zoomScale, type ZoomMode } from './surfaces'

export type PreviewStatus =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'timeout' }
  | { kind: 'error'; code: PrototypeBridgeErrorCode }
  | { kind: 'unavailable' }

/** Imperative surface for the host's screen-addressable navigation. */
export type PreviewHandle = {
  /** Navigate the live prototype to one of its declared screens. */
  goto(screenId: string): void
}

export type PrototypePreviewProps = {
  /** Promise resolving to the repository variant HTML. */
  source: Promise<string>
  prototypeId: string
  variantId: string
  surfaceId: SurfaceId
  scenarioId: string
  themeId: string
  /** Screen registry for this variant/scenario, jump fixtures included. */
  screens: ScreenRuntimeDeclaration[]
  /** Screen to show initially; defaults to the document's start screen. */
  startScreen?: string | null
  zoom: ZoomMode
  /** Profile-pinned frame geometry; absent = contract presets. */
  deviceChrome?: DeviceChrome
  /** Extra remount trigger (comparison slot, manual reload). */
  reloadKey?: number
  onStatus?: (status: PreviewStatus) => void
  /** Every screen the runtime shows after `ready`. */
  onScreen?: (screenId: string) => void
  ref?: Ref<PreviewHandle | null>
}

const READY_TIMEOUT_MS = 3000

function makeChannelId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function PrototypePreview(props: PrototypePreviewProps): JSX.Element {
  const { source, prototypeId, variantId, surfaceId, scenarioId, themeId, screens, startScreen, zoom, deviceChrome, reloadKey = 0, onStatus, onScreen, ref } = props
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
    () => ({
      protocolVersion: 2,
      channelId,
      prototypeId,
      variantId,
      surfaceId,
      scenarioId,
      themeId,
      screens,
    }),
    [channelId, prototypeId, variantId, surfaceId, scenarioId, themeId, screens],
  )

  const sandboxDocument = useMemo(() => {
    if (html === null) return null
    return buildSandboxDocument(html, context)
  }, [html, context])

  const statusRef = useRef(onStatus)
  statusRef.current = onStatus
  const update = useCallback((next: PreviewStatus) => {
    setStatus(next)
    statusRef.current?.(next)
  }, [])

  // Lazy HTML load: a failure shows Preview unavailable without crashing
  // the shell. Each load bumps a generation so the bridge state machine
  // resets with the actual iframe remount, not just on selection changes.
  const [loadGeneration, setLoadGeneration] = useState(0)
  useEffect(() => {
    let cancelled = false
    setHtml(null)
    setLoadFailure(false)
    setLoadGeneration((n) => n + 1)
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
  }, [source, channelId, update])

  const mountKey = `${channelId}-${loadGeneration}`

  // Bridge: hostile-message filtering, single ready, repeatable screen, at most one error.
  const acceptedReady = useRef(false)
  const acceptedError = useRef(false)
  const shownScreen = useRef<string | null>(null)
  const bootHandled = useRef(false)
  const handleScreen = useRef(onScreen)
  handleScreen.current = onScreen
  useEffect(() => {
    acceptedReady.current = false
    acceptedError.current = false
    shownScreen.current = null
    bootHandled.current = false
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
      if (acceptance.kind === 'screen') {
        if (acceptedReady.current) {
          shownScreen.current = acceptance.screenId
          // The boot emission shows the document's start screen; when a
          // specific screen was requested (deep link, retained position),
          // correct the prototype instead of syncing the host URL to the
          // boot screen — that would silently drop the requested screen.
          if (!bootHandled.current && startScreen && acceptance.screenId !== startScreen) {
            iframeRef.current?.contentWindow?.postMessage(buildGotoMessage(channelId, startScreen), '*')
            return
          }
          bootHandled.current = true
          handleScreen.current?.(acceptance.screenId)
        }
        return
      }
      if (acceptedError.current) return
      acceptedError.current = true
      update({ kind: 'error', code: acceptance.code })
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [mountKey, channelId, update])

  // Parent-to-child navigation once the bridge is live.
  useImperativeHandle(
    ref,
    () => ({
      goto(screenId: string): void {
        const target = iframeRef.current?.contentWindow
        if (!target || !acceptedReady.current) return
        target.postMessage(buildGotoMessage(channelId, screenId), '*')
      },
    }),
    [channelId],
  )

  // `startScreen` never enters the mount context (a changing context
  // would rebuild the srcDoc and reload the prototype). Instead it is
  // enforced live: once the bridge is ready, any divergence from the
  // screen the runtime last reported is corrected with a `goto`.
  useEffect(() => {
    if (!startScreen || shownScreen.current === startScreen) return
    const target = iframeRef.current?.contentWindow
    if (!target || !acceptedReady.current) return
    target.postMessage(buildGotoMessage(channelId, startScreen), '*')
  }, [startScreen, channelId, status])

  // Ready timeout: retain the iframe, show fixed parent-owned copy.
  useEffect(() => {
    if (status.kind !== 'loading' || sandboxDocument === null) return
    const timer = window.setTimeout(() => {
      if (status.kind === 'loading') update({ kind: 'timeout' })
    }, READY_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [status, sandboxDocument, update])

  // Unexpected second iframe load of the same mount after ready is
  // UNEXPECTED_NAVIGATION; a fresh mount generation resets the count.
  const loadCount = useRef(0)
  const onLoad = useCallback(() => {
    loadCount.current += 1
    if (loadCount.current > 1 && acceptedReady.current) {
      update({ kind: 'error', code: 'UNEXPECTED_NAVIGATION' })
    }
  }, [update])
  useEffect(() => {
    loadCount.current = 0
  }, [mountKey])

  const preset = surfacePreset(surfaceId, deviceChrome)
  const frame = surfaceFrameSize(preset)
  const scale = container ? zoomScale(zoom, container, frame) : 1
  // The sizer carries the *scaled* footprint: CSS transforms paint smaller
  // but keep the logical layout box, so an unscaled 876 px-tall iOS frame
  // would overflow and scroll the canvas behind the device. Sizing the
  // sizer to the scaled dimensions keeps the canvas itself static; only
  // deliberate over-zoom pans inside the wrap.
  const scaled = { width: Math.round(frame.width * scale), height: Math.round(frame.height * scale) }
  const frameRadius = preset.chrome.outerRadius
  const screenRadius = preset.chrome.kind === 'ios' ? Math.max(0, preset.chrome.outerRadius - preset.chrome.bezel) : 0

  return (
    <div className="preview-stage" data-status={status.kind}>
      <div className="preview-frame-wrap" ref={wrapNodeRef}>
        {sandboxDocument !== null ? (
          <div className="preview-frame-sizer" style={{ width: scaled.width, height: scaled.height }}>
            <div
              className={`preview-frame preview-frame-${preset.chrome.kind}`}
              style={{
                width: frame.width,
                height: frame.height,
                transform: `scale(${scale})`,
                borderRadius: frameRadius,
                ...(preset.chrome.kind === 'ios' ? { padding: preset.chrome.bezel } : {}),
              }}
            >
            {preset.chrome.kind === 'desktop' ? (
              <div
                className="preview-chrome-titlebar"
                style={{ height: preset.chrome.titleBarHeight, borderRadius: `${frameRadius}px ${frameRadius}px 0 0` }}
                aria-hidden="true"
              >
                <span className="preview-chrome-dots" />
                <span className="preview-chrome-title">{`${prototypeId} — ${variantId}`}</span>
              </div>
            ) : (
              <div
                className="preview-chrome-island"
                style={{
                  width: preset.chrome.island.width,
                  height: preset.chrome.island.height,
                  top: preset.chrome.bezel + Math.round((preset.safeArea.top - preset.chrome.island.height) / 2),
                }}
                aria-hidden="true"
              />
            )}
            <iframe
              key={mountKey}
              ref={iframeRef}
              className="preview-iframe"
              title={`Prototype ${prototypeId}, variant ${variantId}, surface ${surfaceId}, scenario ${scenarioId}, theme ${themeId}`}
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              allow=""
              srcDoc={sandboxDocument}
              onLoad={onLoad}
              style={{ width: preset.content.width, height: preset.content.height, borderRadius: screenRadius }}
            />
            {preset.chrome.kind === 'ios' ? (
              <div
                className="preview-chrome-home"
                style={{ width: preset.chrome.homeIndicator.width, height: preset.chrome.homeIndicator.height, bottom: preset.chrome.bezel }}
                aria-hidden="true"
              />
            ) : null}
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
