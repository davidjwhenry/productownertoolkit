/**
 * Copy-to-clipboard action with a manual fallback textarea when the
 * Clipboard API is unavailable or blocked.
 */
import { useState, type JSX } from 'react'

export function CopyAction(props: { label: string; text: string; className?: string }): JSX.Element {
  const { label, text, className } = props
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
      <button type="button" className={className ?? 'copy-button'} onClick={() => void onCopy()}>{label}</button>
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
