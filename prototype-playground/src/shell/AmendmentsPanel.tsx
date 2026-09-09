/**
 * Amendments column: writeable review state pinned to a screen and
 * requirement. Proposing, resolving, dismissing, reopening, and deleting
 * all round-trip through the dev-server endpoint (`PUT
 * /__playground__/amendments/:prototypeId`), which re-validates the whole
 * document before an atomic replace. The static hand-off build has no
 * server: the panel turns read-only with a copy-export.
 */
import { useEffect, useMemo, useState, type JSX } from 'react'
import type { Amendment, AmendmentStatus, PrototypeRecord } from '../contracts'
import type { Selection, SelectionUpdateOptions } from './useSelectionState'
import { CopyAction } from './CopyAction'

type AmendmentsPanelProps = {
  record: PrototypeRecord
  selection: Selection
  update: (next: Partial<Selection>, options?: SelectionUpdateOptions) => void
  writable: boolean
}

const STATUS_LABEL: Record<AmendmentStatus, string> = { open: 'Open', resolved: 'Resolved', dismissed: 'Dismissed' }

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function nextAmendmentId(existing: Amendment[]): string {
  let sequence = existing.length + 1
  const taken = new Set(existing.map((amendment) => amendment.id))
  let id = `am-${String(sequence).padStart(3, '0')}`
  while (taken.has(id)) {
    sequence += 1
    id = `am-${String(sequence).padStart(3, '0')}`
  }
  return id
}

export function AmendmentsPanel(props: AmendmentsPanelProps): JSX.Element {
  const { record, selection, update, writable } = props
  const [amendments, setAmendments] = useState<Amendment[]>(record.amendments)
  const [proposing, setProposing] = useState(false)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [author, setAuthor] = useState('')
  const [screenId, setScreenId] = useState('')
  const [requirementId, setRequirementId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setAmendments(record.amendments)
    setProposing(false)
    setError(null)
  }, [record.id, record.amendments])

  const variant = record.variants.find((candidate) => candidate.id === selection.variantId) ?? record.variants[0]
  const screens = useMemo(() => {
    const byId = new Map<string, { id: string; label: string; scenarioId: string }>()
    for (const declaration of variant?.screens ?? []) {
      if (!byId.has(declaration.id)) {
        byId.set(declaration.id, { id: declaration.id, label: declaration.label, scenarioId: declaration.scenarioId })
      }
    }
    return [...byId.values()]
  }, [variant])
  const requirementIds = useMemo(
    () => [...new Set([...record.source.requirementIds, ...record.scenarios.flatMap((scenario) => scenario.requirementIds)])],
    [record],
  )
  const openCount = amendments.filter((amendment) => amendment.status === 'open').length

  const persist = async (next: Amendment[]): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/__playground__/amendments/${record.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ schemaVersion: 1, amendments: next }),
      })
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { error?: string } | null
        setError(detail?.error ?? `Save failed (${response.status})`)
        return false
      }
      const doc = (await response.json()) as { amendments: Amendment[] }
      setAmendments(doc.amendments)
      return true
    } catch {
      setError('Save failed — is the dev server running?')
      return false
    } finally {
      setBusy(false)
    }
  }

  const propose = async (): Promise<void> => {
    if (!variant || !screenId || title.trim() === '' || note.trim() === '' || author.trim() === '') {
      setError('Title, note, author, and screen are all required')
      return
    }
    const screen = screens.find((candidate) => candidate.id === screenId)
    if (!screen) return
    const amendment: Amendment = {
      id: nextAmendmentId(amendments),
      screenId,
      requirementId: requirementId || null,
      title: title.trim(),
      note: note.trim(),
      selection: {
        variantId: variant.id,
        surfaceId: selection.surfaceId,
        scenarioId: screen.scenarioId,
        themeId: selection.themeId,
        screenId,
      },
      author: author.trim(),
      date: today(),
      status: 'open',
    }
    if (await persist([...amendments, amendment])) {
      setTitle('')
      setNote('')
      setScreenId('')
      setRequirementId('')
      setProposing(false)
    }
  }

  const setStatus = (id: string, status: AmendmentStatus): void => {
    void persist(amendments.map((amendment) => (amendment.id === id ? { ...amendment, status } : amendment)))
  }

  const remove = (id: string): void => {
    void persist(amendments.filter((amendment) => amendment.id !== id))
  }

  const jump = (amendment: Amendment): void => {
    update({
      variantId: amendment.selection.variantId,
      surfaceId: amendment.selection.surfaceId,
      scenarioId: amendment.selection.scenarioId,
      themeId: amendment.selection.themeId,
      screenId: amendment.screenId,
      compareVariantId: null,
    })
  }

  return (
    <section className="amendments-panel">
      <header className="notes-heading">
        <h2>Amendments</h2>
        <span className={openCount > 0 ? 'amendments-count chip-accent-text' : 'amendments-count'}>{openCount} open</span>
      </header>

      {amendments.length === 0 && !proposing ? (
        <p className="notes-empty">No amendments yet. Reviews that change the design land here, pinned to a screen and requirement.</p>
      ) : null}

      <ul className="amendments-list">
        {amendments.map((amendment) => {
          const screenLabel = screens.find((candidate) => candidate.id === amendment.screenId)?.label ?? amendment.screenId
          return (
            <li key={amendment.id} className="amendment-card" data-status={amendment.status}>
              <div className="amendment-head">
                <button type="button" className="amendment-title" onClick={() => jump(amendment)} title="Jump to this screen">
                  {amendment.title}
                </button>
                <span className={`amendment-status amendment-status-${amendment.status}`}>{STATUS_LABEL[amendment.status]}</span>
              </div>
              <p className="amendment-note">{amendment.note}</p>
              <p className="amendment-meta">
                Screen · {screenLabel}{amendment.requirementId ? ` — ${amendment.requirementId}` : ''} · {amendment.author}, {amendment.date}
              </p>
              {writable ? (
                <div className="amendment-actions">
                  {amendment.status === 'open' ? (
                    <>
                      <button type="button" disabled={busy} onClick={() => setStatus(amendment.id, 'resolved')}>Resolve</button>
                      <button type="button" disabled={busy} onClick={() => setStatus(amendment.id, 'dismissed')}>Dismiss</button>
                    </>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => setStatus(amendment.id, 'open')}>Reopen</button>
                  )}
                  <button type="button" className="amendment-delete" disabled={busy} onClick={() => remove(amendment.id)}>Delete</button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      {proposing ? (
        <form
          className="amendment-form"
          onSubmit={(event) => {
            event.preventDefault()
            void propose()
          }}
        >
          <label htmlFor="amendment-title">Title</label>
          <input id="amendment-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="Round-up daily cap" required />
          <label htmlFor="amendment-note">Note</label>
          <textarea id="amendment-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={8192} rows={3} placeholder="What should change, and why" required />
          <label htmlFor="amendment-screen">Screen</label>
          <select id="amendment-screen" value={screenId} onChange={(event) => setScreenId(event.target.value)} required>
            <option value="">Select a screen…</option>
            {screens.map((screen) => (
              <option key={screen.id} value={screen.id}>{screen.label}</option>
            ))}
          </select>
          <label htmlFor="amendment-requirement">Requirement</label>
          <select id="amendment-requirement" value={requirementId} onChange={(event) => setRequirementId(event.target.value)}>
            <option value="">None</option>
            {requirementIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
          <label htmlFor="amendment-author">Author</label>
          <input id="amendment-author" value={author} onChange={(event) => setAuthor(event.target.value)} maxLength={160} placeholder="Your name" required />
          {error ? <p className="amendment-error" role="alert">{error}</p> : null}
          <div className="amendment-form-actions">
            <button type="submit" className="button-primary" disabled={busy}>Save amendment</button>
            <button type="button" className="button-ghost" disabled={busy} onClick={() => setProposing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="amendments-actions">
          {writable ? (
            <button type="button" className="button-primary" onClick={() => setProposing(true)}>Propose amendment</button>
          ) : null}
          <CopyAction label="Copy review link" text={`${window.location.origin}${window.location.pathname}?${new URLSearchParams({
            prototype: selection.prototypeId,
            variant: selection.variantId,
            surface: selection.surfaceId,
            scenario: selection.scenarioId,
            theme: selection.themeId,
            ...(selection.screenId ? { screen: selection.screenId } : {}),
          }).toString()}`} className="button-secondary" />
          <CopyAction
            label="Copy amendments JSON"
            text={JSON.stringify({ schemaVersion: 1, amendments }, null, 2)}
            className="button-ghost"
          />
          {error ? <p className="amendment-error" role="alert">{error}</p> : null}
        </div>
      )}
    </section>
  )
}
