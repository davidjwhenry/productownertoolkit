/**
 * Copy-to-clipboard action with a manual fallback textarea when the
 * Clipboard API is unavailable or blocked.
 */
import { useEffect, useState, type JSX } from 'react'

/** Copy the supplied payload with short-lived success feedback and a persistent manual fallback when clipboard access fails. */
export function CopyAction(props: { label: string; text: string; className?: string; disabled?: boolean; successMessage?: string }): JSX.Element {
  const { label, text, className, disabled = false, successMessage = 'Copied.' } = props
  const [state, setState] = useState<'idle' | 'done' | 'failed' | 'fallback'>('idle')
  const [copyCount, setCopyCount] = useState(0)
  useEffect(() => {
    if (state !== 'done') return
    const timer = window.setTimeout(() => setState('idle'), 2000)
    return () => window.clearTimeout(timer)
  }, [state, copyCount])
  const onCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setState('done')
      setCopyCount((count) => count + 1)
    } catch {
      setState(navigator.clipboard ? 'failed' : 'fallback')
    }
  }
  return (
    <>
      <button type="button" disabled={disabled} className={className ?? 'copy-button'} onClick={() => void onCopy()}>{label}</button>
      {state === 'done' ? <p className="copy-status" role="status" style={{ color: 'var(--shell-success)' }}>{successMessage}</p> : null}
      {state === 'failed' ? <p className="copy-status" role="alert">Copy failed — use the text below.</p> : null}
      {state === 'failed' || state === 'fallback' ? (
        <label className="copy-status" style={{ display: 'block' }}>
          Manual copy
          <textarea className="copy-fallback" rows={6} readOnly value={text} onFocus={(event) => event.target.select()} />
        </label>
      ) : null}
    </>
  )
}
