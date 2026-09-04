/**
 * The neutral application shell: a 272 px catalogue sidebar, flexible
 * canvas, 320 px inspector, and compact toolbar. `mode: 'handoff'`
 * replaces the catalogue sidebar with the permanent prototype-only
 * banner while retaining canvas controls and inspector. Below 1,100 px
 * the inspector and catalogue collapse into labelled drawers.
 */
import { useMemo, useState, type JSX } from 'react'
import type { CatalogueResult, PrototypeRecord, SurfaceId } from '../contracts'
import { PrototypePreview } from '../preview/PrototypePreview'
import { SURFACE_PRESETS, ZOOM_MODES, type ZoomMode } from '../preview/surfaces'
import { buildRevisionBrief, type Selection, type SelectionResolution } from './useSelectionState'
import './shell.css'

export type ShellMode = 'catalogue' | 'handoff'

export type AppShellProps = {
  mode: ShellMode
  catalogue: CatalogueResult
  resolution: SelectionResolution
  update: (next: Partial<Selection>) => void
}

function groupRecords(records: PrototypeRecord[]): Array<{ key: string; records: PrototypeRecord[] }> {
  const groups = new Map<string, PrototypeRecord[]>()
  for (const record of records) {
    const key =
      record.origin === 'example'
        ? 'Examples'
        : `${record.classification ?? 'requirement'} · ${record.feature}`
    const bucket = groups.get(key)
    if (bucket) bucket.push(record)
    else groups.set(key, [record])
  }
  return [...groups.entries()].map(([key, grouped]) => ({ key, records: grouped }))
}

function CopyAction({ label, text }: { label: string; text: string }): JSX.Element {
  const [state, setState] = useState<'idle' | 'done' | 'failed' | 'fallback'>('idle')
  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setState('done')
    } catch {
      setState(navigator.clipboard ? 'failed' : 'fallback')
    }
  }
  return (
    <>
      <button type="button" className="copy-button" onClick={() => void onCopy()}>{label}</button>
      {state === 'done' ? <p className="copy-status" style={{ color: 'var(--shell-accent)' }}>Copied.</p> : null}
      {state === 'failed' ? <p className="copy-status">Copy failed — use the text below.</p> : null}
      {state === 'failed' || state === 'fallback' ? (
        <label className="copy-status" style={{ display: 'block' }}>
          Manual copy
          <textarea className="copy-fallback" rows={6} readOnly value={text} onFocus={(event) => event.target.select()} />
        </label>
      ) : null}
    </>
  )
}

export function AppShell(props: AppShellProps): JSX.Element {
  const { mode, catalogue, resolution, update } = props
  const { record, selection, warnings } = resolution
  const [query, setQuery] = useState('')
  const [zoom, setZoom] = useState<ZoomMode>('fit')
  const [catalogueOpen, setCatalogueOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)

  const hasLive = catalogue.records.some((r) => r.origin === 'requirement')
  const visibleRecords = useMemo(() => {
    const pool = selection.showExamples || !hasLive ? catalogue.records : catalogue.records.filter((r) => r.origin === 'requirement')
    if (query.trim() === '') return pool
    const needle = query.trim().toLowerCase()
    return pool.filter((record) =>
      [record.id, record.title, record.summary, record.brief.primaryUser, record.feature].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    )
  }, [catalogue.records, query, selection.showExamples, hasLive])

  const themes = record
    ? (catalogue.profiles[`${record.designSystem.id}@${record.designSystem.version}`]?.themes ?? [])
    : []

  const diagnostics = useMemo(
    () => [...warnings, ...catalogue.diagnostics],
    [warnings, catalogue.diagnostics],
  )

  return (
    <div className={mode === 'handoff' ? 'app-shell app-shell-handoff' : 'app-shell'}>
      {mode === 'handoff' ? (
        <div className="handoff-banner" role="status">Interactive prototype — not production code</div>
      ) : (
        <header className="shell-toolbar">
          <h1>Prototype Playground</h1>
          <span className="meta">
            {catalogue.activeProfile
              ? `${catalogue.activeProfile.id}@${catalogue.activeProfile.version}`
              : 'no active design profile'}
          </span>
          <span className="spacer" />
          <button type="button" className="drawer-toggle" aria-expanded={catalogueOpen} onClick={() => setCatalogueOpen((v) => !v)}>Catalogue</button>
          <button type="button" className="drawer-toggle" aria-expanded={inspectorOpen} onClick={() => setInspectorOpen((v) => !v)}>Inspector</button>
          <button type="button" className="drawer-toggle" aria-expanded={diagnosticsOpen} onClick={() => setDiagnosticsOpen((v) => !v)}>
            Diagnostics{diagnostics.length > 0 ? ` (${diagnostics.length})` : ''}
          </button>
        </header>
      )}

      {mode === 'catalogue' ? (
        <nav className="shell-catalogue" data-open={catalogueOpen} aria-label="Prototype catalogue">
          <input
            type="search"
            className="catalogue-search"
            placeholder="Search id, title, summary, user, feature"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={120}
          />
          <label className="shell-checkbox">
            <input
              type="checkbox"
              checked={selection.showExamples}
              onChange={(event) => update({ showExamples: event.target.checked })}
            />
            Show examples
          </label>
          {visibleRecords.length === 0 ? (
            <div className="catalogue-empty">
              <p>No prototypes found.</p>
              <p>Generate one with <code>prototype-builder</code> and a PRD path.</p>
            </div>
          ) : (
            groupRecords(visibleRecords).map((group) => (
              <div className="catalogue-group" key={group.key}>
                <h2>{group.key}</h2>
                {group.records.map((item) => (
                  <button
                    type="button"
                    className="catalogue-item"
                    key={item.id}
                    aria-current={record?.id === item.id}
                    onClick={() =>
                      update({
                        prototypeId: item.id,
                        variantId: item.defaults.variant,
                        surfaceId: item.defaults.surface,
                        scenarioId: item.defaults.scenario,
                        themeId: item.defaults.theme,
                        compareVariantId: null,
                      })
                    }
                  >
                    <span className="title">{item.title}{item.origin === 'example' ? <span className="catalogue-badge">Example</span> : null}</span>
                    <span className="detail">{item.summary}</span>
                    <span className="detail">{item.designSystem.id}@{item.designSystem.version}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </nav>
      ) : null}

      <main className="shell-canvas">
        {!catalogue.activeProfile ? (
          <div className="empty-state">
            <h2>No active design profile</h2>
            <p>Run the <code>design-system-setup</code> skill to compile <code>design-system/profiles/</code> and write <code>ACTIVE</code>.</p>
          </div>
        ) : !record ? (
          <div className="empty-state">
            <h2>No prototypes to preview</h2>
            <p>Run the <code>prototype-builder</code> skill with a PRD path to generate feature-local prototypes under <code>requirements/</code> or <code>examples/</code>.</p>
          </div>
        ) : (
          <>
            <div className="canvas-controls">
              <div className="control-group variant-segment" role="group" aria-label="Variant">
                {record.variants.map((variant) => (
                  <button
                    type="button"
                    key={variant.id}
                    aria-pressed={variant.id === selection.variantId}
                    onClick={() => update({ variantId: variant.id, compareVariantId: null })}
                  >
                    {variant.label}
                  </button>
                ))}
              </div>
              <div className="control-group">
                <label htmlFor="surface-select">Surface</label>
                <select
                  id="surface-select"
                  className="control-select"
                  value={selection.surfaceId}
                  onChange={(event) => update({ surfaceId: event.target.value as SurfaceId })}
                >
                  {record.surfaces.map((surface) => (
                    <option key={surface} value={surface}>{SURFACE_PRESETS[surface].label} · {SURFACE_PRESETS[surface].content.width} × {SURFACE_PRESETS[surface].content.height}</option>
                  ))}
                </select>
              </div>
              <div className="control-group">
                <label htmlFor="scenario-select">Scenario</label>
                <select
                  id="scenario-select"
                  className="control-select"
                  value={selection.scenarioId}
                  onChange={(event) => update({ scenarioId: event.target.value })}
                >
                  {record.scenarios.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>{scenario.label}</option>
                  ))}
                </select>
              </div>
              <div className="control-group">
                <label htmlFor="theme-select">Theme</label>
                <select
                  id="theme-select"
                  className="control-select"
                  value={selection.themeId}
                  onChange={(event) => update({ themeId: event.target.value })}
                >
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>{theme.label}</option>
                  ))}
                </select>
              </div>
              <div className="control-group">
                <label htmlFor="zoom-select">Zoom</label>
                <select id="zoom-select" className="zoom-select" value={zoom} onChange={(event) => setZoom(event.target.value as ZoomMode)}>
                  {ZOOM_MODES.map((mode_) => (
                    <option key={mode_} value={mode_}>{mode_ === 'fit' ? 'Fit' : `${mode_}%`}</option>
                  ))}
                </select>
              </div>
              {record.variants.length > 1 ? (
                <label className="compare-toggle">
                  <input
                    type="checkbox"
                    checked={selection.compareVariantId !== null}
                    onChange={(event) =>
                      update({
                        compareVariantId: event.target.checked
                          ? (record.variants.find((v) => v.id !== selection.variantId)?.id ?? null)
                          : null,
                      })
                    }
                  />
                  Compare
                </label>
              ) : null}
            </div>
            <div className="preview-canvas" data-compare={selection.compareVariantId !== null}>
              <figure className="preview-pane">
                <PrototypePreview
                  source={record.loadVariant(selection.variantId)}
                  prototypeId={record.id}
                  variantId={selection.variantId}
                  surfaceId={selection.surfaceId}
                  scenarioId={selection.scenarioId}
                  themeId={selection.themeId}
                  zoom={zoom}
                />
                {selection.compareVariantId ? <figcaption>{record.variants.find((v) => v.id === selection.variantId)?.label}</figcaption> : null}
              </figure>
              {selection.compareVariantId ? (
                <figure className="preview-pane">
                  <PrototypePreview
                    source={record.loadVariant(selection.compareVariantId)}
                    prototypeId={record.id}
                    variantId={selection.compareVariantId}
                    surfaceId={selection.surfaceId}
                    scenarioId={selection.scenarioId}
                    themeId={selection.themeId}
                    zoom={zoom}
                  />
                  <figcaption>{record.variants.find((v) => v.id === selection.compareVariantId)?.label}</figcaption>
                </figure>
              ) : null}
            </div>
          </>
        )}
      </main>

      <aside className="shell-inspector" data-open={inspectorOpen} aria-label="Prototype inspector">
        {record ? (
          <>
            <div className="inspector-section">
              <h2>Build brief</h2>
              <dl>
                <dt>Primary user</dt><dd>{record.brief.primaryUser}</dd>
                <dt>Job</dt><dd>{record.brief.job}</dd>
                <dt>Journey</dt><dd>{record.brief.journey}</dd>
                <dt>Decision</dt><dd>{record.brief.decision}</dd>
              </dl>
            </div>
            <div className="inspector-section">
              <h2>Variant — {record.variants.find((v) => v.id === selection.variantId)?.label ?? selection.variantId}</h2>
              <p style={{ margin: '0 0 6px' }}>{record.variants.find((v) => v.id === selection.variantId)?.hypothesis}</p>
              <ul>
                {(record.variants.find((v) => v.id === selection.variantId)?.tradeOffs ?? []).map((tradeOff) => (
                  <li key={tradeOff}>{tradeOff}</li>
                ))}
              </ul>
            </div>
            <div className="inspector-section">
              <h2>Traceability</h2>
              <dl>
                <dt>PRD</dt><dd><code>{record.source.prd}</code></dd>
                <dt>Requirements</dt><dd>{record.source.requirementIds.join(', ')}</dd>
                <dt>Manifest</dt><dd><code>{record.manifestPath}</code></dd>
              </dl>
            </div>
            <div className="inspector-section">
              <h2>Design profile</h2>
              <dl>
                <dt>Profile</dt><dd>{record.designSystem.id}@{record.designSystem.version}</dd>
                <dt>Currentness</dt>
                <dd className={record.designSystem.currentness === 'active' ? 'currentness-active' : 'currentness-older'}>
                  {record.designSystem.currentness === 'active' ? 'Active' : 'Older design profile'}
                </dd>
                <dt>Fingerprint</dt><dd><code>{record.designSystem.fingerprint}</code></dd>
              </dl>
            </div>
            <div className="inspector-section">
              <h2>Scenario — {record.scenarios.find((s) => s.id === selection.scenarioId)?.label ?? selection.scenarioId}</h2>
              <p style={{ margin: 0 }}>{record.scenarios.find((s) => s.id === selection.scenarioId)?.description}</p>
            </div>
            <div className="inspector-section">
              <h2>Prototype-only limitations</h2>
              <ul>{record.prototypeOnly.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
            </div>
            {record.companions.length > 0 ? (
              <div className="inspector-section">
                <h2>Companions</h2>
                <ul>{record.companions.map((companion) => <li key={companion.path}><code>{companion.path}</code> ({companion.kind})</li>)}</ul>
              </div>
            ) : null}
            <div className="inspector-section">
              <h2>Actions</h2>
              <CopyAction label="Copy revision brief" text={buildRevisionBrief(selection, record.manifestPath)} />
            </div>
          </>
        ) : (
          <div className="catalogue-empty">
            <p>Select a prototype to inspect its brief, hypotheses, and traceability.</p>
          </div>
        )}
        {diagnosticsOpen || diagnostics.length > 0 ? (
          <div className="inspector-section">
            <h2>Diagnostics</h2>
            {diagnostics.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--shell-muted)' }}>No diagnostics.</p>
            ) : (
              <ul className="diagnostics-list">
                {diagnostics.map((diagnostic, index) => (
                  <li key={`${diagnostic.code}-${index}`}>
                    <span className={`severity severity-${diagnostic.severity}`}>{diagnostic.severity}</span> {diagnostic.code}
                    <code>{diagnostic.path}</code>
                    <span>{diagnostic.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </aside>
    </div>
  )
}
