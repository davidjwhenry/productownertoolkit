/**
 * The guided look of `init`: a gradient wordmark, a stepper, and bordered
 * cards. Shown only when the user is being prompted; scripted and piped runs
 * stay plain, and every element still reads correctly without colour (DT.7).
 */
import { paint, type Io } from './io.ts'

type Styled = Pick<Io, 'color' | 'env' | 'columns'>

/** Three-row block letters; only the letters the wordmark needs. */
const FONT: Record<string, [string, string, string]> = {
  P: ['█▀█', '█▀▀', '▀  '],
  R: ['█▀█', '█▀▄', '▀ ▀'],
  O: ['█▀█', '█ █', '▀▀▀'],
  D: ['█▀▄', '█ █', '▀▀ '],
  U: ['█ █', '█ █', '▀▀▀'],
  C: ['█▀▀', '█  ', '▀▀▀'],
  T: ['▀█▀', ' █ ', ' ▀ '],
  W: ['█ █ █', '█ █ █', '▀▀▀▀▀'],
  N: ['█▀█', '█ █', '▀ ▀'],
  E: ['█▀▀', '█▀▀', '▀▀▀'],
  K: ['█ █', '█▀▄', '▀ ▀'],
  I: ['█', '█', '▀'],
  L: ['█  ', '█  ', '▀▀▀'],
  ' ': ['  ', '  ', '  '],
}

const GRADIENT: Array<[number, number, number]> = [
  [56, 189, 248],
  [129, 140, 248],
  [232, 121, 249],
]

function blockText(text: string): string[] {
  return [0, 1, 2].map((row) => [...text].map((letter) => FONT[letter]![row]).join(' '))
}

/** Colour each column along the gradient; terminals without 24-bit colour get one accent colour. */
function gradient(io: Styled, text: string, width = text.length): string {
  if (!io.color) return text
  if (!/truecolor|24bit/i.test(io.env.COLORTERM ?? '')) return paint(io, 'cyan', text)
  const last = Math.max(1, width - 1)
  const painted = [...text].map((char, column) => {
    if (char === ' ') return char
    const at = (Math.min(column, last) / last) * (GRADIENT.length - 1)
    const from = GRADIENT[Math.floor(at)]!
    const to = GRADIENT[Math.min(GRADIENT.length - 1, Math.floor(at) + 1)]!
    const [r, g, b] = from.map((channel, i) => Math.round(channel + (to[i]! - channel) * (at - Math.floor(at))))
    return `\u001b[38;2;${r};${g};${b}m${char}`
  })
  return `${painted.join('')}\u001b[39m`
}

/** The opening wordmark, one string per line. Narrow terminals get a single-line title instead. */
export function banner(io: Styled, version: string): string[] {
  const tagline = 'Sense · Synthesise · Ship'
  const art = [...blockText('PRODUCT OWNER'), ...blockText('TOOLKIT')]
  const width = Math.max(...art.map((line) => line.length))
  if (io.columns < width + 4) {
    return ['', `  ${gradient(io, '▲')} ${paint(io, 'bold', 'Product Owner Toolkit')} ${paint(io, 'dim', `v${version}`)}`, `    ${paint(io, 'dim', tagline)}`]
  }
  const meta = `v${version}`
  return [
    '',
    ...art.map((line) => `  ${gradient(io, line.padEnd(width), width)}`),
    '',
    `  ${paint(io, 'bold', tagline)}${' '.repeat(width - tagline.length - meta.length)}${paint(io, 'dim', meta)}`,
    `  ${gradient(io, '━'.repeat(width), width)}`,
  ]
}

/** Progress through the prompts: `✔ Agents  ● Capabilities  ○ Folder  ○ Review`. */
export function stepper(io: Styled, steps: string[], current: number): string {
  return steps
    .map((title, index) => {
      if (index < current) return paint(io, 'green', `✔ ${title}`)
      if (index === current) return paint(io, 'bold', `${gradient(io, '●')} ${title}`)
      return paint(io, 'dim', `○ ${title}`)
    })
    .join(paint(io, 'dim', '  ─  '))
}

/** A titled block with a left border, so long lines never have to fit a box. */
export function card(io: Styled, title: string, lines: string[]): string[] {
  const edge = (text: string) => paint(io, 'cyan', text)
  return [`${edge('╭─')} ${paint(io, 'bold', title)}`, ...lines.map((line) => `${edge('│')} ${line}`.trimEnd()), edge('╰─')]
}
