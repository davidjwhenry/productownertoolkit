import { useEffect, useRef, type JSX, type ReactNode } from 'react'

/** A dropdown whose contents never participate in the action row's layout. */
export function AmendmentMenu({ children }: { children: ReactNode }): JSX.Element {
  const menu = useRef<HTMLDetailsElement | null>(null)
  useEffect(() => {
    const dismiss = (event: PointerEvent): void => {
      if (menu.current?.open && event.target instanceof Node && !menu.current.contains(event.target)) menu.current.open = false
    }
    window.addEventListener('pointerdown', dismiss)
    return () => window.removeEventListener('pointerdown', dismiss)
  }, [])
  return (
    <details ref={menu} className="amendment-more" onKeyDown={(event) => {
      if (event.key === 'Escape' && menu.current?.open) {
        event.preventDefault()
        event.stopPropagation()
        menu.current.open = false
        menu.current.querySelector('summary')?.focus()
      }
    }} onBlur={(event) => {
      if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
    }}>
      <summary>More <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></summary>
      <div className="amendment-menu" onClick={(event) => {
        if (event.target instanceof Element && event.target.closest('button') && menu.current) {
          menu.current.open = false
          menu.current.querySelector('summary')?.focus()
        }
      }}>{children}</div>
    </details>
  )
}
