import readline from 'node:readline'
import { accentCode } from './io.ts'

export interface Choice {
  id: string
  label: string
  hint?: string
}

export interface SelectOptions {
  /** Space toggles, Enter confirms. Single-select returns the highlighted choice on Enter. */
  multi: boolean
  /** Ids ticked (multi) or highlighted (single) to start with. */
  initial?: string[]
  /** Decorate with colour; the markers alone carry the meaning. */
  color?: boolean
  truecolor?: boolean
}

/** Arrow-key / space selector on a TTY. No dependencies; Ctrl-C exits like any other prompt. */
export function selectPrompt(
  input: NodeJS.ReadStream,
  output: NodeJS.WriteStream,
  message: string,
  choices: Choice[],
  { multi, initial = [], color = false, truecolor = false }: SelectOptions,
): Promise<string[]> {
  const picked = new Set(initial)
  let cursor = Math.max(0, multi ? 0 : choices.findIndex((c) => c.id === initial[0]))
  const help = multi ? '↑/↓ move, space select, enter confirm' : '↑/↓ move, enter confirm'
  const accent = accentCode(truecolor)
  const style = (code: number | string, text: string) => (color ? `\u001b[${code}m${text}\u001b[0m` : text)
  const lines = () => [
    `${style(1, message)} ${style(2, `(${help})`)}`,
    ...choices.map((c, i) => {
      const mark = multi ? (picked.has(c.id) ? `${style(32, '◉')} ` : `${style(2, '○')} `) : ''
      const label = i === cursor ? style(accent, c.label) : c.label
      return `${i === cursor ? style(accent, '❯') : ' '} ${mark}${label}${c.hint ? `  ${style(2, c.hint)}` : ''}`
    }),
  ]
  let drawn = 0
  const draw = () => {
    if (drawn) output.write(`\u001b[${drawn}F\u001b[J`)
    const out = lines()
    output.write(`${out.join('\n')}\n`)
    drawn = out.length
  }

  return new Promise((resolve) => {
    readline.emitKeypressEvents(input)
    input.setRawMode(true)
    input.resume()
    const finish = (ids: string[]) => {
      input.off('keypress', onKey)
      input.setRawMode(false)
      input.pause()
      output.write(`\u001b[${drawn}F\u001b[J${style(32, '✔')} ${message.replace(/\?$/, '')}: ${style(accent, ids.map((id) => choices.find((c) => c.id === id)?.label ?? id).join(', ') || 'none')}\n`)
      resolve(ids)
    }
    const onKey = (_: string, key: readline.Key) => {
      if (key.ctrl && key.name === 'c') {
        input.setRawMode(false)
        output.write('\n')
        process.exit(130)
      }
      if (key.name === 'up' || key.name === 'k') cursor = (cursor + choices.length - 1) % choices.length
      else if (key.name === 'down' || key.name === 'j') cursor = (cursor + 1) % choices.length
      else if (key.name === 'space' && multi) {
        const id = choices[cursor].id
        if (!picked.delete(id)) picked.add(id)
      } else if (key.name === 'return') {
        return finish(multi ? choices.filter((c) => picked.has(c.id)).map((c) => c.id) : [choices[cursor].id])
      }
      draw()
    }
    input.on('keypress', onKey)
    draw()
  })
}
