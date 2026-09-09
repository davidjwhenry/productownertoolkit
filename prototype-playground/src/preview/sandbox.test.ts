import { describe, expect, it } from 'vitest'
import { buildRuntimeScript, buildSandboxDocument, CHILD_CSP_TEMPLATE, escapeScriptJson, makeNonce } from './sandbox'
import type { PrototypeContext } from '../contracts'
import { validEntryHtml } from '../testing/make-fixture-repo'
import { parse } from 'parse5'
import type { DefaultTreeAdapterMap } from 'parse5'

function makeContext(overrides: Partial<PrototypeContext> = {}): PrototypeContext {
  return {
    protocolVersion: 2,
    channelId: '0123456789abcdef0123456789abcdef',
    prototypeId: 'demo',
    variantId: 'focused',
    surfaceId: 'desktop',
    scenarioId: 'happy-path',
    themeId: 'light',
    screens: [],
    ...overrides,
  }
}

function headChildren(html: string): Array<{ name: string; value: string }> {
  const document = parse(html)
  const htmlNode = document.childNodes.find((node) => node.nodeName === 'html') as DefaultTreeAdapterMap['element']
  const head = htmlNode?.childNodes?.find((node) => node.nodeName === 'head') as DefaultTreeAdapterMap['element']
  return (head?.childNodes ?? []).map((child) => (child as DefaultTreeAdapterMap['element']).attrs?.[0] ?? { name: child.nodeName, value: '' })
}

function scriptTags(html: string): Array<{ nonce: string | undefined; text: string }> {
  const document = parse(html)
  const out: Array<{ nonce: string | undefined; text: string }> = []
  const visit = (node: DefaultTreeAdapterMap['node']): void => {
    if (node.nodeName === 'script') {
      const element = node as DefaultTreeAdapterMap['element']
      out.push({
        nonce: element.attrs.find((a) => a.name === 'nonce')?.value,
        text: (element.childNodes ?? []).map((c) => ((c as { value?: string }).value ?? '')).join(''),
      })
    } else if ('childNodes' in node) {
      for (const child of node.childNodes ?? []) visit(child)
    }
  }
  visit(document)
  return out
}

describe('escapeScriptJson', () => {
  it('escapes the full breakout set', () => {
    expect(escapeScriptJson('</script><script>')).toBe('\\u003c/script\\u003e\\u003cscript\\u003e')
    expect(escapeScriptJson('a & b < c > d')).toBe('a \\u0026 b \\u003c c \\u003e d')
    expect(escapeScriptJson('line\u2028break\u2029end')).toBe('line\\u2028break\\u2029end')
  })
})

describe('makeNonce', () => {
  it('returns a fresh 128-bit hexadecimal nonce per call', () => {
    const first = makeNonce()
    const second = makeNonce()
    expect(first).toMatch(/^[0-9a-f]{32}$/)
    expect(second).toMatch(/^[0-9a-f]{32}$/)
    expect(first).not.toBe(second)
  })
})

describe('buildSandboxDocument', () => {
  it('inserts the child CSP as the first child of head and one nonce-matching script', () => {
    const document = buildSandboxDocument(validEntryHtml(), makeContext())
    const [first] = headChildren(document)
    expect(first).toMatchObject({ name: 'http-equiv', value: 'Content-Security-Policy' })
    const scripts = scriptTags(document)
    expect(scripts).toHaveLength(1)
    const script = scripts[0]
    const cspMeta = document.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/)
    expect(cspMeta?.[1]).toBe(CHILD_CSP_TEMPLATE.replace('<nonce>', script?.nonce ?? ''))
    expect(cspMeta?.[1]).toContain(`script-src 'nonce-${script?.nonce}'`)
  })

  it('hides document scrollbars on the ios surface only, with the CSP still first', () => {
    const ios = buildSandboxDocument(validEntryHtml(), makeContext({ surfaceId: 'ios' }))
    const [iosFirst, iosSecond] = headChildren(ios)
    expect(iosFirst).toMatchObject({ name: 'http-equiv', value: 'Content-Security-Policy' })
    expect(iosSecond).toMatchObject({ name: 'data-prototype-scrollbars', value: 'hidden' })
    expect(ios).toContain('scrollbar-width: none')
    expect(ios).toContain('::-webkit-scrollbar')
    const desktop = buildSandboxDocument(validEntryHtml(), makeContext({ surfaceId: 'desktop' }))
    expect(desktop).not.toContain('data-prototype-scrollbars')
    expect(desktop).not.toContain('scrollbar-width')
  })

  it('embeds the frozen context ahead of the exact repository runtime', () => {
    const context = makeContext()
    const script = scriptTags(buildSandboxDocument(validEntryHtml(), context))[0]?.text ?? ''
    expect(script).toContain('"channelId":"0123456789abcdef0123456789abcdef"')
    expect(script.endsWith(buildRuntimeScript(context))).toBe(true)
  })

  it('produces different nonces per load', () => {
    const context = makeContext()
    const one = scriptTags(buildSandboxDocument(validEntryHtml(), context))[0]?.nonce
    const two = scriptTags(buildSandboxDocument(validEntryHtml(), context))[0]?.nonce
    expect(one).not.toBe(two)
  })

  it('throws before mounting when the entry violates the allow-list', () => {
    const hostile = validEntryHtml().replace('<h1>Home</h1>', '<h1>Home</h1><script>alert(1)</script>')
    expect(() => buildSandboxDocument(hostile, makeContext())).toThrow('allow-list')
  })

  it('keeps hostile context values inert inside the script block', () => {
    const context = makeContext({ scenarioId: '</script><script>alert(1)</script>' })
    const document = buildSandboxDocument(validEntryHtml(), context)
    // The raw breakout payload never appears literally in the output.
    expect(document).not.toContain('</script><script>alert(1)</script>')
    const scripts = scriptTags(document)
    expect(scripts).toHaveLength(1)
  })

  it('escapes U+2028 and U+2029 in the embedded context', () => {
    const context = makeContext({ scenarioId: 'line\u2028sep\u2029' })
    const script = scriptTags(buildSandboxDocument(validEntryHtml(), context))[0]?.text ?? ''
    expect(script).toContain('line\\u2028sep\\u2029')
  })
})
