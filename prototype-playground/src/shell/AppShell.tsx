/**
 * The application shell in the Gallery direction: a 228 px catalogue
 * rail, a 260 px scenario/screen sub-menu, a centred stage (scenario
 * readout, PRD strip, device preview, control deck), and a 292 px notes
 * column with verbatim PRD design notes and the amendments subsystem.
 * `mode: 'handoff'` drops the catalogue rail for the permanent
 * prototype-only banner and makes amendments read-only. Below 1,240 px
 * the columns collapse into labelled drawers.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from 'react'
import type { CatalogueResult, PrototypeRecord, SurfaceId } from '../contracts'
import { PrototypePreview, type PreviewHandle } from '../preview/PrototypePreview'
import { SURFACE_PRESETS, ZOOM_MODES, type ZoomMode } from '../preview/surfaces'
import { buildRevisionBrief, type Selection, type SelectionResolution, type SelectionUpdateOptions } from './useSelectionState'
import { AmendmentsPanel } from './AmendmentsPanel'
import { CopyAction } from './CopyAction'
import './shell.css'

export type ShellMode = 'catalogue' | 'handoff'

export type AppShellProps = {
  mode: ShellMode
  catalogue: CatalogueResult
  resolution: SelectionResolution
  update: (next: Partial<Selection>, options?: SelectionUpdateOptions) => void
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

export function AppShell(props: AppShellProps): JSX.Element {
  const { mode, catalogue, resolution, update } = props
  const { record, selection, warnings } = resolution
  const [query, setQuery] = useState('')
  const [zoom, setZoom] = useState<ZoomMode>('fit')
  const [railOpen, setRailOpen] = useState(false)
  const [flowOpen, setFlowOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const previewRef = useRef<PreviewHandle | null>(null)
  const hasLive = catalogue.records.some((r) => r.origin === 'requirement')
  // Default to showing examples once, on mount, only when no requirement
  // prototypes exist yet; the checkbox is the sole source of truth after that.
  const defaultedExamplesRef = useRef(false)
  useEffect(() => {
    if (defaultedExamplesRef.current) return
    defaultedExamplesRef.current = true
    if (!hasLive && !selection.showExamples) update({ showExamples: true }, { history: 'replace' })
  }, [hasLive, selection.showExamples, update])
  const visibleRecords = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const pool = selection.showExamples ? catalogue.records : catalogue.records.filter((r) => r.origin === 'requirement')
    if (needle === '') return pool
    return pool.filter((record) =>
      record.id.includes(needle) ||
      record.title.toLowerCase().includes(needle) ||
      record.summary.toLowerCase().includes(needle) ||
      record.brief.primaryUser.toLowerCase().includes(needle) ||
      record.feature.includes(needle),
    )
  }, [catalogue.records, query, selection.showExamples])

  const diagnostics = useMemo(
    () => [...warnings, ...catalogue.diagnostics],
    [warnings, catalogue.diagnostics],
  )

  const variant = record?.variants.find((v) => v.id === selection.variantId) ?? null
  const scenario = record?.scenarios.find((s) => s.id === selection.scenarioId) ?? null
  const scenarioIndex = record ? record.scenarios.findIndex((s) => s.id === selection.scenarioId) + 1 : 0
  const scenarioScreens = useMemo(() => {
    const screens = variant?.screens?.filter((screen) => screen.scenarioId === selection.scenarioId) ?? []
    return [...screens].sort((a, b) => a.order - b.order)
  }, [variant, selection.scenarioId])
  const themes = record
    ? (catalogue.profiles[`${record.designSystem.id}@${record.designSystem.version}`]?.themes ?? [])
    : []
  const deviceChrome = record
    ? catalogue.profiles[`${record.designSystem.id}@${record.designSystem.version}`]?.deviceChrome
    : undefined
  const layout = catalogue.activeProfile?.layout
  const layoutStyle = layout
    ? ({
        '--shell-rail-w': `${layout.railWidth}px`,
        '--shell-flow-w': `${layout.flowWidth}px`,
        '--shell-notes-w': `${layout.notesWidth}px`,
        '--shell-stage-max': `${layout.stageMaxWidth}px`,
      } as CSSProperties)
    : undefined
  const activeScreen = scenarioScreens.find((screen) => screen.id === selection.screenId) ?? null
  const stepIndex = activeScreen ? scenarioScreens.findIndex((screen) => screen.id === activeScreen.id) + 1 : 0
  const runtimeScreens = useMemo(
    () => scenarioScreens.map((screen) => ({ id: screen.id, ...(screen.fixture ? { fixture: screen.fixture } : {}) })),
    [scenarioScreens],
  )

  const primarySource = useMemo(
    () => (record ? record.loadVariant(selection.variantId) : null),
    [record, selection.variantId],
  )
  const compareSource = useMemo(
    () => (record && selection.compareVariantId ? record.loadVariant(selection.compareVariantId) : null),
    [record, selection.compareVariantId],
  )

  const onScreen = (screenId: string): void => {
    if (screenId !== selection.screenId) update({ screenId }, { history: 'replace' })
  }

  const jumpToScreen = (screenId: string): void => {
    update({ screenId })
    previewRef.current?.goto(screenId)
  }

  const prdUrl = (section: string): string | null => {
    if (!record || !record.prdMap.url) return null
    const anchor = record.prdMap.sections.find((candidate) => candidate.section === section)?.anchor
    return anchor ? `${record.prdMap.url}#${anchor}` : record.prdMap.url
  }

  const stripRefs = activeScreen
    ? activeScreen.prdRefs.map((ref) => {
        const heading = record?.prdMap.sections.find((candidate) => candidate.section === ref.section)
        return { section: ref.section, heading: heading?.heading ?? null, requirementIds: ref.requirementIds }
      })
    : (scenario?.requirementIds ?? []).map((requirementId) => ({ section: null, heading: null, requirementIds: [requirementId] }))
  const stripRequirementIds = [...new Set(stripRefs.flatMap((ref) => ref.requirementIds))]

  return (
    <div className={mode === 'handoff' ? 'app-shell app-shell-handoff' : 'app-shell'} style={layoutStyle}>
      {mode === 'handoff' ? (
        <div className="handoff-banner" role="status">Interactive prototype — not production code</div>
      ) : null}

      <header className="shell-compactbar" aria-label="Playground controls">
        <span className="compactbar-brand">Prototype Playground</span>
        <span className="spacer" />
        <button type="button" className="drawer-toggle" aria-expanded={railOpen} onClick={() => setRailOpen((v) => !v)}>Catalogue</button>
        <button type="button" className="drawer-toggle" aria-expanded={flowOpen} onClick={() => setFlowOpen((v) => !v)}>Flows</button>
        <button type="button" className="drawer-toggle" aria-expanded={notesOpen} onClick={() => setNotesOpen((v) => !v)}>Notes</button>
        <button type="button" className="drawer-toggle" aria-expanded={diagnosticsOpen} onClick={() => setDiagnosticsOpen((v) => !v)}>
          Diagnostics{diagnostics.length > 0 ? ` (${diagnostics.length})` : ''}
        </button>
      </header>

      {mode === 'catalogue' ? (
        <nav className="shell-rail" data-open={railOpen} aria-label="Prototype catalogue">
          <div className="rail-brand">
            <span className="rail-brand-mark" aria-hidden="true" />
            <h1>Prototype Playground</h1>
          </div>
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
                        screenId: null,
                        compareVariantId: null,
                      })
                    }
                  >
                    <span className="title">{item.title}{item.origin === 'example' ? <span className="catalogue-badge">Example</span> : null}</span>
                    <span className="detail">{item.summary}</span>
                    <span className="detail">Revision {item.revision} · {item.variants.length} variants · {item.scenarios.length} scenarios</span>
                  </button>
                ))}
              </div>
            ))
          )}
          <div className="rail-footer">
            <h2>Design profile</h2>
            {catalogue.activeProfile ? (
              <p>
                {catalogue.activeProfile.id}@{catalogue.activeProfile.version} <span className="chip-mini">Active</span>
                <br />
                <code>{catalogue.activeProfile.fingerprint.slice(0, 23)}…</code>
              </p>
            ) : (
              <p>No active design profile.</p>
            )}
            <button type="button" className="diagnostics-toggle" aria-expanded={diagnosticsOpen} onClick={() => setDiagnosticsOpen((v) => !v)}>
              Diagnostics{diagnostics.length > 0 ? ` (${diagnostics.length})` : ''}
            </button>
          </div>
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
            <aside className="flow-column" data-open={flowOpen} aria-label="Scenarios and screens">
              <h2 className="flow-heading">Flows — {record.scenarios.length} scenarios</h2>
              {record.scenarios.map((item, index) => {
                const isActive = item.id === selection.scenarioId
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={isActive ? 'scenario-card scenario-card-active' : 'scenario-card'}
                    aria-current={isActive}
                    onClick={() => update({ scenarioId: item.id })}
                  >
                    <span className="scenario-number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="scenario-label">{item.label}</span>
                    <span className="scenario-description">{item.description}</span>
                    <span className="scenario-refs">{item.requirementIds.join(' · ')}</span>
                  </button>
                )
              })}
              {scenarioScreens.length > 0 ? (
                <div className="screens-list">
                  <h3>Screens — {scenario?.label ?? selection.scenarioId} · jump freely</h3>
                  <ul>
                    {scenarioScreens.map((screen, index) => (
                      <li key={screen.id}>
                        <button
                          type="button"
                          className="screen-row"
                          aria-current={screen.id === selection.screenId}
                          onClick={() => jumpToScreen(screen.id)}
                        >
                          <span className="screen-order">{screen.branch ? '⤷' : index + 1}</span>
                          <span className="screen-label">{screen.label}</span>
                          <span className="screen-refs">§{screen.prdRefs.map((ref) => ref.section).join(' §')}</span>
                          <span className="screen-chevron" aria-hidden="true">›</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="screens-empty">This prototype declares no addressable screens; walk the flow inside the preview.</p>
              )}
            </aside>

            <section className="stage-column">
              <header className="stage-header">
                <p className="stage-eyebrow">
                  Scenario {String(scenarioIndex).padStart(2, '0')} · {scenario?.label ?? selection.scenarioId}
                  {activeScreen ? ` — step ${stepIndex} of ${scenarioScreens.length}` : ''}
                </p>
                <h2 className="stage-title">{activeScreen?.label ?? variant?.label ?? record.title}</h2>
                <div className="prd-strip">
                  {stripRefs.map((ref, index) =>
                    ref.section !== null ? (
                      <span className="prd-chip" key={`${ref.section}-${index}`}>
                        {ref.heading ? `PRD §${ref.section} · ${ref.heading}` : `PRD §${ref.section}`}
                      </span>
                    ) : null,
                  )}
                  {stripRequirementIds.length > 0 ? (
                    <span className="prd-covered">
                      Covers <strong>{stripRequirementIds.join(' ')}</strong>
                    </span>
                  ) : null}
                  {record.prdMap.url ? (
                    <a
                      className="prd-open"
                      href={prdUrl(stripRefs[0]?.section ?? '') ?? record.prdMap.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open PRD ↗
                    </a>
                  ) : (
                    <span className="prd-path" title={record.source.prd}><code>{record.source.prd}</code></span>
                  )}
                </div>
              </header>

              <div className="preview-canvas" data-compare={selection.compareVariantId !== null}>
                <figure className="preview-pane">
                  <PrototypePreview
                    ref={previewRef}
                    source={primarySource ?? Promise.reject(new Error('no record'))}
                    prototypeId={record.id}
                    variantId={selection.variantId}
                    surfaceId={selection.surfaceId}
                    scenarioId={selection.scenarioId}
                    themeId={selection.themeId}
                    screens={runtimeScreens}
                    startScreen={selection.screenId}
                    zoom={zoom}
                    deviceChrome={deviceChrome}
                    onScreen={onScreen}
                  />
                  {selection.compareVariantId ? <figcaption>{variant?.label}</figcaption> : null}
                </figure>
                {selection.compareVariantId ? (
                  <figure className="preview-pane">
                    <PrototypePreview
                      source={compareSource ?? Promise.reject(new Error('no compare variant'))}
                      prototypeId={record.id}
                      variantId={selection.compareVariantId}
                      surfaceId={selection.surfaceId}
                      scenarioId={selection.scenarioId}
                      themeId={selection.themeId}
                      screens={[]}
                      zoom={zoom}
                      deviceChrome={deviceChrome}
                    />
                    <figcaption>{record.variants.find((v) => v.id === selection.compareVariantId)?.label}</figcaption>
                  </figure>
                ) : null}
              </div>

              <div className="control-deck" role="group" aria-label="Preview controls">
                <div className="deck-variant">
                  <div className="deck-label">Variant</div>
                  <div className="variant-segment" role="group" aria-label="Variant">
                    {record.variants.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        aria-pressed={item.id === selection.variantId}
                        onClick={() => update({ variantId: item.id, compareVariantId: null })}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <p className="deck-hypothesis">{variant?.hypothesis}</p>
                </div>
                <div className="deck-controls">
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
              </div>
            </section>
          </>
        )}
      </main>

      <aside className="notes-column" data-open={notesOpen} aria-label="Design notes and amendments">
        {record ? (
          <>
            <section className="design-notes">
              <header className="notes-heading">
                <h2>Design notes</h2>
                <span className="notes-source">{record.source.prd.split('/').pop()}</span>
              </header>
              {record.designNotes.length === 0 ? (
                <p className="notes-empty">No design-notes companion declared. `prototype-builder` writes one with verbatim PRD passages.</p>
              ) : (
                record.designNotes.map((note) => {
                  const url = prdUrl(note.section)
                  const heading = record.prdMap.sections.find((candidate) => candidate.section === note.section)?.heading
                  return (
                    <article className="design-note" key={note.id}>
                      {url ? (
                        <a className="note-chip" href={url} target="_blank" rel="noreferrer">§{note.section} · {note.label}</a>
                      ) : (
                        <span className="note-chip">§{note.section} · {note.label}</span>
                      )}
                      <blockquote className="note-quote">{note.quote}</blockquote>
                      <p className="note-meta">
                        {heading ? `${heading} — ` : ''}
                        {note.requirementIds.length > 0 ? note.requirementIds.join(', ') : 'context'}
                      </p>
                    </article>
                  )
                })
              )}
            </section>

            <AmendmentsPanel record={record} selection={selection} update={update} writable={mode === 'catalogue'} />

            <section className="notes-footer">
              <h2>Prototype-only limitations</h2>
              <ul>{record.prototypeOnly.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
              <div className="notes-footer-actions">
                <CopyAction label="Copy revision brief" text={buildRevisionBrief(selection, record.manifestPath)} className="button-ghost" />
              </div>
              <p className="notes-fineprint">
                Fixture data only — confirming records nothing. Prototype runs on the declarative runtime.
                {' '}Profile {record.designSystem.id}@{record.designSystem.version}
                {record.designSystem.currentness === 'older' ? ' (older design profile)' : ''}.
              </p>
            </section>
          </>
        ) : (
          <p className="notes-empty">Select a prototype to see its PRD notes and amendments.</p>
        )}
        {diagnosticsOpen || (diagnostics.length > 0 && !record) ? (
          <section className="inspector-section">
            <h2>Diagnostics</h2>
            {diagnostics.length === 0 ? (
              <p className="notes-empty">No diagnostics.</p>
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
          </section>
        ) : null}
      </aside>
    </div>
  )
}
