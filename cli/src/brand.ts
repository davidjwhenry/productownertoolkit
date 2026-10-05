/**
 * The guided look of `init`: a banner and numbered step headings. Shown only
 * when the user is being prompted; scripted and piped runs stay plain (DT.7).
 */
import { paint, type Io } from './io.ts'

const INNER = 45

/** The boxed wordmark, one string per line. Box-drawing only, so it renders on every supported terminal. */
export function banner(io: Pick<Io, 'color'>, version: string): string[] {
  const row = (plain: string, painted: string) => `${paint(io, 'dim', '│')}${painted}${' '.repeat(INNER - plain.length)}${paint(io, 'dim', '│')}`
  const title = 'Product Owner Toolkit'
  const tag = `v${version}`
  const gap = ' '.repeat(Math.max(1, INNER - 5 - title.length - tag.length - 2))
  const tagline = 'Sense · Synthesise · Ship'
  return [
    paint(io, 'dim', `┌${'─'.repeat(INNER)}┐`),
    row(`  ▲  ${title}${gap}${tag}`, `  ${paint(io, 'cyan', '▲')}  ${paint(io, 'bold', title)}${gap}${paint(io, 'dim', tag)}`),
    row(`     ${tagline}`, `     ${paint(io, 'dim', tagline)}`),
    paint(io, 'dim', `└${'─'.repeat(INNER)}┘`),
  ]
}

/** A step heading such as `2/4 Capabilities`. */
export function stepHeading(io: Pick<Io, 'color'>, index: number, total: number, title: string): string {
  return `${paint(io, 'cyan', `${index}/${total}`)} ${paint(io, 'bold', title)}`
}
