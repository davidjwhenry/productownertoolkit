import { useEffect, useRef, type ReactNode, type JSX } from 'react'

/** Keep drafts mounted across layouts and keep floating panels mounted through exit. */
export function WorkspacePanel({ className, label, title, modal, open, onClose, children }: {
  className: string; label: string; title: string; modal: boolean; open: boolean
  onClose: () => void; children: ReactNode
}): JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const node = dialog.current
    if (!node) return
    if (open) {
      delete node.dataset.closing
      node.inert = false
      if (node.open && node.matches(':modal') !== modal) node.close()
      if (!node.open) {
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        if (modal) node.showModal()
        else node.setAttribute('open', '')
      }
    } else if (node.open) {
      const focusInside = node.contains(document.activeElement)
      const close = (): void => {
        node.close()
        delete node.dataset.closing
        node.inert = false
        if (focusInside) returnFocus.current?.focus()
      }
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !node.matches('.shell-rail, .notes-column, .workspace-drawer')) {
        close()
      } else {
        node.dataset.closing = 'true'
        node.inert = true
        const timer = window.setTimeout(close, 480)
        return () => window.clearTimeout(timer)
      }
    }
  }, [open, modal])
  useEffect(() => {
    if (!open || modal || className !== 'notes-column') return
    const dismiss = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !document.querySelector('dialog:modal')) {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', dismiss)
    return () => window.removeEventListener('keydown', dismiss)
  }, [open, modal, onClose, className])
  useEffect(() => () => { dialog.current?.close() }, [])
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
