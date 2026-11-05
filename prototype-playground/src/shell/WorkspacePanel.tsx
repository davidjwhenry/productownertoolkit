import { useEffect, useRef, type ReactNode, type JSX } from 'react'

/** Native modal drawers isolate focus and restore it to their opener on close. */
export function WorkspacePanel({ className, label, title, modal, open, onClose, children }: {
  className: string; label: string; title: string; modal: boolean; open: boolean
  onClose: () => void; children: ReactNode
}): JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = dialog.current
    if (!node) return
    if (node.open) node.close()
    if (open) {
      if (modal) node.showModal()
      else node.show()
    }
    return () => { if (node.open) node.close() }
  }, [open, modal])
  const content = <>
    <header className="panel-heading"><h2>{title}</h2>
      {(modal || className === 'notes-column') ? <button type="button" className="drawer-toggle" aria-label={`Close ${title}`} onClick={onClose}>×</button> : null}
    </header>
    {children}
  </>
  return <dialog ref={dialog} className={`${className} workspace-panel${modal ? ' workspace-drawer' : ''}`} aria-label={label} role={modal ? 'dialog' : 'complementary'}
    onKeyDown={(event) => {
      if (!modal || event.key !== 'Tab') return
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]'))
        .filter((node) => node.tabIndex >= 0 && !node.matches(':disabled') && node.getClientRects().length > 0)
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
    }}>{content}</dialog>
}
