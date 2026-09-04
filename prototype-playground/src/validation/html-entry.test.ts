import { describe, expect, it } from 'vitest'
import { validateHtmlEntry } from './html-entry'
import { validEntryHtml } from '../testing/make-fixture-repo'

const SCENARIOS = ['happy-path']

function entryChecks(html: string): string[] {
  return validateHtmlEntry(html, SCENARIOS).checks.map((check) => `${check.where}: ${check.message}`)
}

function mutate(html: string, replacement: string, needle = '  <main>'): string {
  return html.replace(needle, `  ${replacement}`)
}

describe('validateHtmlEntry — document structure', () => {
  it('accepts the canonical fixture entry', () => {
    expect(entryChecks(validEntryHtml())).toEqual([])
  })

  it('rejects a missing doctype', () => {
    const html = validEntryHtml().replace('<!DOCTYPE html>\n', '')
    expect(entryChecks(html).some((m) => m.includes('doctype'))).toBe(true)
  })

  it('rejects a missing lang attribute', () => {
    expect(entryChecks(validEntryHtml().replace('<html lang="en">', '<html>')).some((m) => m.includes('`lang`'))).toBe(true)
  })

  it('rejects a missing title and viewport', () => {
    const html = validEntryHtml().replace('  <title>Fixture entry</title>\n', '').replace('  <meta name="viewport" content="width=device-width, initial-scale=1">\n', '')
    const checks = entryChecks(html)
    expect(checks.some((m) => m.includes('<title>'))).toBe(true)
    expect(checks.some((m) => m.includes('viewport'))).toBe(true)
  })

  it('rejects non-semantic bodies', () => {
    const html = validEntryHtml().replace(/<main>|<\/main>/g, '').replace(/section data-prototype-screen/g, 'div data-prototype-screen')
    expect(entryChecks(html).some((m) => m.includes('semantic'))).toBe(true)
  })
})

describe('validateHtmlEntry — self-containment allow-list', () => {
  it('rejects executable scripts, including literal payloads in text', () => {
    for (const payload of [
      '<script>alert(1)</script>',
      '<script src="data:text/javascript,alert(1)"></script>',
      '<script type="module">window.x = "</script><script>"</script>',
    ]) {
      expect(entryChecks(mutate(validEntryHtml(), payload)).some((m) => m.includes('Forbidden element `<script>`'))).toBe(true)
    }
  })

  it('rejects inline event handlers and javascript: URLs', () => {
    expect(entryChecks(mutate(validEntryHtml(), '<button type="button" onclick="alert(1)">X</button>')).some((m) => m.includes('event handler'))).toBe(true)
    expect(entryChecks(mutate(validEntryHtml(), '<a href="javascript:alert(1)">X</a>')).some((m) => m.includes('Script-scheme URL'))).toBe(true)
    expect(entryChecks(mutate(validEntryHtml(), '<a href="https://example.com">X</a>')).some((m) => m.includes('fragment'))).toBe(true)
    expect(entryChecks(mutate(validEntryHtml(), '<a href="#done">Skip</a>')).filter((m) => m.includes('href')).length).toBe(0)
  })

  it('rejects navigation and embedding elements and attributes', () => {
    for (const payload of [
      '<base href="https://example.com/">',
      '<iframe src="https://example.com"></iframe>',
      '<object data="x"></object>',
      '<embed src="x">',
      '<meta http-equiv="refresh" content="1">',
      '<form action="https://example.com" id="f2"><input type="text" name="q" maxlength="8"></form>',
      '<button type="button" formaction="https://example.com">X</button>',
      '<link rel="stylesheet" href="x.css">',
    ]) {
      expect(entryChecks(mutate(validEntryHtml(), payload)).length).toBeGreaterThan(0)
    }
  })

  it('permits data: resource URLs only on allow-listed attributes', () => {
    const good = mutate(validEntryHtml(), '<img src="data:image/png;base64,iVBOR" alt="Logo">')
    expect(entryChecks(good).filter((m) => m.includes('Resource URLs'))).toEqual([])
    const bad = mutate(validEntryHtml(), '<a href="data:image/png;base64,iVBOR">X</a>')
    expect(entryChecks(bad).some((m) => m.includes('`href` must reference'))).toBe(true)
    const badTag = mutate(validEntryHtml(), '<div src="data:image/png;base64,iVBOR">X</div>')
    expect(entryChecks(badTag).some((m) => m.includes('Resource URLs'))).toBe(true)
  })

  it('rejects CSS @import and remote url()', () => {
    const html = validEntryHtml().replace('<style>body { color: #111; }</style>', '<style>@import url("https://example.com/x.css"); body { background: url(https://example.com/bg.png); }</style>')
    const checks = entryChecks(html)
    expect(checks.some((m) => m.includes('@import'))).toBe(true)
    expect(checks.some((m) => m.includes('`url()` must reference `data:`'))).toBe(true)
  })
})

describe('validateHtmlEntry — declarative graph', () => {
  it('rejects a missing or unknown start screen', () => {
    expect(entryChecks(validEntryHtml().replace(' data-prototype-start="home"', '')).some((m) => m.includes('data-prototype-start'))).toBe(true)
    expect(entryChecks(validEntryHtml().replace('data-prototype-start="home"', 'data-prototype-start="ghost"')).some((m) => m.includes('not a declared screen'))).toBe(true)
  })

  it('rejects duplicate screen IDs and non-section screens', () => {
    const duplicate = mutate(validEntryHtml(), '<section data-prototype-screen="done" id="done-2"></section>')
    expect(entryChecks(duplicate).some((m) => m.includes('Duplicate screen ID'))).toBe(true)
    const nonSection = mutate(validEntryHtml(), '<div data-prototype-screen="extra" id="extra"></div>')
    expect(entryChecks(nonSection).some((m) => m.includes('Screens must be `<section>`'))).toBe(true)
  })

  it('rejects unknown transition targets and multiple actions', () => {
    expect(entryChecks(validEntryHtml().replace('data-prototype-go="done"', 'data-prototype-go="ghost"')).some((m) => m.includes('not a declared screen'))).toBe(true)
    const twoActions = mutate(validEntryHtml(), '<button type="button" data-prototype-go="done" data-prototype-reset>Two</button>')
    expect(entryChecks(twoActions).some((m) => m.includes('exactly one action attribute'))).toBe(true)
    const nonButton = mutate(validEntryHtml(), '<span data-prototype-go="done">Fake</span>')
    expect(entryChecks(nonButton).some((m) => m.includes('only allowed on `<button>`'))).toBe(true)
  })

  it('rejects scenario maps without a * fallback or with undeclared branches', () => {
    const noFallback = validEntryHtml().replace('data-prototype-go-by-scenario="happy-path:home,*:home"', 'data-prototype-go-by-scenario="happy-path:home"')
    expect(entryChecks(noFallback).some((m) => m.includes('exactly one `*` fallback'))).toBe(true)
    const undeclared = validEntryHtml().replace('data-prototype-go-by-scenario="happy-path:home,*:home"', 'data-prototype-go-by-scenario="ghost-scenario:home,*:home"')
    expect(entryChecks(undeclared).some((m) => m.includes('not declared in the manifest'))).toBe(true)
    const badTarget = validEntryHtml().replace('data-prototype-go-by-scenario="happy-path:home,*:home"', 'data-prototype-go-by-scenario="happy-path:ghost,*:home"')
    expect(entryChecks(badTarget).some((m) => m.includes('not a declared screen'))).toBe(true)
  })

  it('rejects unknown toggle, validation, bind, and scenario targets', () => {
    expect(entryChecks(validEntryHtml().replace('data-prototype-toggle="detail-region"', 'data-prototype-toggle="ghost"')).some((m) => m.includes('Toggle target'))).toBe(true)
    expect(entryChecks(validEntryHtml().replace('data-prototype-validate="amount-form"', 'data-prototype-validate="ghost"')).some((m) => m.includes('Validation target'))).toBe(true)
    expect(entryChecks(validEntryHtml().replace('data-prototype-bind="amount"', 'data-prototype-bind="ghost"')).some((m) => m.includes('control name'))).toBe(true)
    expect(entryChecks(validEntryHtml().replace('data-prototype-scenario="happy-path"', 'data-prototype-scenario="ghost"')).some((m) => m.includes('not declared in the manifest'))).toBe(true)
  })

  it('rejects unknown data-prototype attributes and misplaced ones', () => {
    expect(entryChecks(mutate(validEntryHtml(), '<span data-prototype-nonsense="x">N</span>')).some((m) => m.includes('Unknown runtime attribute'))).toBe(true)
    expect(entryChecks(validEntryHtml().replace('<body data-prototype-start="home">', '<body>')).some((m) => m.includes('data-prototype-start'))).toBe(true)
    const misplaced = mutate(validEntryHtml(), '<span data-prototype-start="home">S</span>')
    expect(entryChecks(misplaced).some((m) => m.includes('only allowed on `<body>`'))).toBe(true)
  })
})

describe('validateHtmlEntry — native controls', () => {
  it('rejects forbidden input types and attributes', () => {
    expect(entryChecks(validEntryHtml().replace('type="text" id="amount"', 'type="password" id="amount"')).some((m) => m.includes('Input type "password"'))).toBe(true)
    expect(entryChecks(validEntryHtml().replace('maxlength="32" required', 'maxlength="32" required pattern="[0-9]+"')).some((m) => m.includes('`pattern` is forbidden'))).toBe(true)
    expect(entryChecks(validEntryHtml().replace('maxlength="32" required', 'maxlength="32" required step="2"')).some((m) => m.includes('`step` is forbidden'))).toBe(true)
    expect(entryChecks(validEntryHtml().replace('maxlength="32" required', 'maxlength="32" required min="lots"')).some((m) => m.includes('finite number'))).toBe(true)
  })

  it('requires bounded maxlength on textual inputs and textareas', () => {
    expect(entryChecks(validEntryHtml().replace(' maxlength="32"', '')).some((m) => m.includes('must set `maxlength`'))).toBe(true)
    const oversized = mutate(validEntryHtml(), '<textarea name="notes" maxlength="8193"></textarea>')
    expect(entryChecks(oversized).some((m) => m.includes('`maxlength` between 1 and 8192'))).toBe(true)
    const unbounded = mutate(validEntryHtml(), '<textarea name="notes"></textarea>')
    expect(entryChecks(unbounded).some((m) => m.includes('`maxlength` between 1 and 8192'))).toBe(true)
  })
})
describe('validateHtmlEntry — injection payloads', () => {
  it('treats hostile free text as inert when escaped, and rejects real script elements when raw', () => {
    const payloads = ['</script><script>alert(1)</script>', '</style><style>body{}</style>', '<!--', '&<>"\'', 'line\u2028sep\u2029']
    for (const text of payloads) {
      const escaped = mutate(validEntryHtml(), `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
      expect(entryChecks(escaped)).toEqual([])
    }
    for (const hostile of ['</script><script>alert(1)</script>', '<script>alert(1)</script>']) {
      const raw = mutate(validEntryHtml(), `<p>${hostile}</p>`)
      expect(entryChecks(raw).some((m) => m.includes('Forbidden element `<script>`'))).toBe(true)
    }
  })
})
