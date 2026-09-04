/**
 * Application entry. The catalogue mode is the default; the hand-off
 * build (Vite mode `handoff`) renders the same shell with the permanent
 * prototype-only banner instead of the catalogue sidebar.
 */
import { type JSX } from 'react'
import catalogue from 'virtual:prototype-registry'
import { AppShell } from './shell/AppShell'
import { useSelectionState } from './shell/useSelectionState'

export default function App(): JSX.Element {
  const mode = import.meta.env.MODE === 'handoff' ? 'handoff' : 'catalogue'
  const { resolution, update } = useSelectionState(catalogue)
  return <AppShell mode={mode} catalogue={catalogue} resolution={resolution} update={update} />
}
