/**
 * `buildSandboxDocument(sourceHtml, context)` — the preview contract.
 * Parses the variant document, re-applies the step-3 allow-list (skipping
 * manifest-level scenario cross-references the registry already verified),
 * inserts the child CSP as the first child of `<head>`, serialises the
 * frozen context with `<`, `>`, `&`, U+2028, and U+2029 escaped, prepends
 * that initialiser to the exact repository runtime, and inserts the
 * complete bytes as the document's only executable `<script>` with a
 * fresh 128-bit nonce authorised by the child policy.
 *
 * Browser-safe: Web Crypto for the nonce, parse5 for parsing/insertion,
 * no Node APIs.
 */
import { defaultTreeAdapter, html as htmlNs, parse, serialize, type DefaultTreeAdapterMap } from 'parse5'
import type { PrototypeContext } from '../contracts'
import { validateHtmlEntry } from '../validation/html-entry'
import { RUNTIME_SOURCE } from './runtime-source'

type Element = DefaultTreeAdapterMap['element']
type TextNode = DefaultTreeAdapterMap['textNode']

const HTML_NAMESPACE = htmlNs.NS.HTML

export const CHILD_CSP_TEMPLATE =
  "default-src 'none'; img-src data:; media-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'nonce-<nonce>'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'"

/** Escape a JSON payload for safe embedding inside a `<script>` block. */
export function escapeScriptJson(value: string): string {
  return value
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/** Build the single executable script: context initialiser + runtime. */
export function buildRuntimeScript(context: PrototypeContext): string {
  const json = escapeScriptJson(JSON.stringify(context))
  return `;globalThis.__PROTOTYPE_PLAYGROUND_CONTEXT__ = ${json};\n${RUNTIME_SOURCE}`
}

/** Fresh 128-bit nonce, hexadecimal. */
export function makeNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function collectScripts(root: DefaultTreeAdapterMap['node']): Element[] {
  const scripts: Element[] = []
  const visit = (node: DefaultTreeAdapterMap['node']): void => {
    if (node.nodeName === 'script') {
      scripts.push(node as Element)
    } else if ('childNodes' in node) {
      for (const child of node.childNodes ?? []) visit(child)
    }
  }
  visit(root)
  return scripts
}

/**
 * Build the sandboxed srcdoc document for one variant load. Throws when
 * the document violates the allow-list; the caller shows the failure
 * without ever mounting the iframe.
 */
export function buildSandboxDocument(sourceHtml: string, context: PrototypeContext): string {
  const report = validateHtmlEntry(sourceHtml, [], { strictScenarioDeclaration: false })
  if (report.checks.length > 0) {
    const first = report.checks[0] as { where: string; message: string }
    throw new Error(`Entry failed the sandbox allow-list: ${first.where}: ${first.message}`)
  }

  const nonce = makeNonce()
  const document = parse(sourceHtml)
  const html = document.childNodes.find((node): node is Element => node.nodeName === 'html')
  const head = html?.childNodes?.find((node): node is Element => node.nodeName === 'head')
  const body = html?.childNodes?.find((node): node is Element => node.nodeName === 'body')
  if (!html || !head || !body) {
    throw new Error('Entry is not a full HTML document')
  }

  // CSP meta as the first child of <head>.
  const csp = defaultTreeAdapter.createElement('meta', HTML_NAMESPACE, [
    { name: 'http-equiv', value: 'Content-Security-Policy' },
    { name: 'content', value: CHILD_CSP_TEMPLATE.replace('<nonce>', nonce) },
  ])
  head.childNodes.unshift(csp)

  // On the iOS surface the host hides document scrollbars: the frame
  // stays scrollable by touch, drag, or wheel, it just never shows a bar.
  if (context.surfaceId === 'ios') {
    const scrollbarStyle = defaultTreeAdapter.createElement('style', HTML_NAMESPACE, [
      { name: 'data-prototype-scrollbars', value: 'hidden' },
    ])
    const css = defaultTreeAdapter.createTextNode(
      'html { scrollbar-width: none; } ::-webkit-scrollbar { width: 0; height: 0; }',
    ) as TextNode
    defaultTreeAdapter.appendChild(scrollbarStyle, css)
    head.childNodes.splice(1, 0, scrollbarStyle)
  }

  // The document's only executable script, carrying the policy nonce.
  const script = defaultTreeAdapter.createElement('script', HTML_NAMESPACE, [{ name: 'nonce', value: nonce }])
  const text = defaultTreeAdapter.createTextNode(buildRuntimeScript(context)) as TextNode
  defaultTreeAdapter.appendChild(script, text)
  defaultTreeAdapter.appendChild(body, script)

  const serialised = serialize(document)

  // Post-serialisation assertion: exactly one executable script exists and
  // it carries the nonce authorised by the policy.
  const scripts = collectScripts(parse(serialised))
  if (scripts.length !== 1) {
    throw new Error(`Expected exactly one executable script after serialisation; found ${scripts.length}`)
  }
  if (scripts[0]?.attrs.find((attribute) => attribute.name === 'nonce')?.value !== nonce) {
    throw new Error('The executable script does not carry the policy nonce')
  }

  return serialised
}
