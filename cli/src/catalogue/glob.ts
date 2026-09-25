/** Minimal glob matching for catalogue patterns: `**`, `*`, `?`, and `{a,b}` over `/`-separated paths. */
export function globToRegExp(glob: string): RegExp {
  let source = ''
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]!
    if (char === '*') {
      if (glob[i + 1] === '*') {
        i++
        if (glob[i + 1] === '/') {
          i++
          source += '(?:.*/)?'
        } else {
          source += '.*'
        }
      } else {
        source += '[^/]*'
      }
    } else if (char === '?') {
      source += '[^/]'
    } else if (char === '{') {
      const end = glob.indexOf('}', i)
      if (end === -1) throw new Error(`Unclosed brace in glob: ${glob}`)
      source += `(?:${glob.slice(i + 1, end).split(',').map(escape).join('|')})`
      i = end
    } else {
      source += escape(char)
    }
  }
  return new RegExp(`^${source}$`)
}

function escape(text: string): string {
  return text.replace(/[.+^$()|[\]\\]/g, '\\$&')
}

export function matchesAny(rel: string, globs: string[]): boolean {
  return globs.some((glob) => globToRegExp(glob).test(rel))
}
