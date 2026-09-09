/**
 * Declarative variant-HTML validation. Re-applies the repository
 * self-containment allow-list and validates the declarative interaction
 * graph from `src/preview/runtime-contract.ts` before any HTML is loaded.
 *
 * Browser-safe: this module depends only on `parse5`, the frozen runtime
 * contract, and string handling — never on Node APIs. The sandbox
 * (`buildSandboxDocument`) applies the same checks again at render time.
 */
import { parse } from 'parse5'
import type { DefaultTreeAdapterMap } from 'parse5'
import {
  ACTION_ATTRIBUTE_NAMES,
  ALLOWED_INPUT_TYPES,
  KEBAB_ID_PATTERN,
  MAX_TEXTAREA_LENGTH,
  MAX_TEXTUAL_INPUT_LENGTH,
  RUNTIME_ATTRIBUTE_PREFIX,
  RUNTIME_ATTRIBUTES,
  TEXTUAL_INPUT_TYPES,
  parseScenarioMap,
} from '../preview/runtime-contract'

export type HtmlEntryCheck = {
  /** Element or document region the message addresses. */
  where: string
  message: string
}

export type HtmlEntryReport = {
  checks: HtmlEntryCheck[]
  screens: string[]
  startScreen: string | null
  /** Declared `name` attributes of input/textarea/select/button/form/output controls. */
  controlNames: string[]
  /** Declared `data-prototype-validation-for` control names. */
  validationTargets: string[]
}

type Element = DefaultTreeAdapterMap['element']
type TextNode = DefaultTreeAdapterMap['textNode']

type Attributes = Array<{ name: string; value: string }>

const FORBIDDEN_TAGS = new Set([
  'script',
  'base',
  'link',
  'iframe',
  'frame',
  'frameset',
  'portal',
  'object',
  'embed',
  'applet',
  'template',
])

const RESOURCE_ATTRIBUTES = new Set(['src', 'poster'])
const RESOURCE_TAGS = new Set(['img', 'video', 'audio', 'source'])
const NAVIGATION_ATTRIBUTES = new Set(['action', 'formaction', 'target', 'srcset', 'ping', 'usemap', 'manifest', 'cite', 'data'])
const DATA_URL_PREFIXES = ['data:image/', 'data:video/', 'data:audio/', 'data:font/', 'data:application/font']
const CONTROL_NAME_TAGS = new Set(['input', 'select', 'textarea', 'button', 'form', 'output'])
const SEMANTIC_TAGS = new Set(['main', 'section', 'nav', 'article', 'aside', 'header', 'footer'])
const KNOWN_RUNTIME_ATTRIBUTES = new Set<string>(Object.values(RUNTIME_ATTRIBUTES))

function attr(element: Element, name: string): string | undefined {
  return element.attrs.find((a) => a.name === name)?.value
}

function textContent(node: DefaultTreeAdapterMap['node']): string {
  if (node.nodeName === '#text') return (node as DefaultTreeAdapterMap['textNode']).value
  if ('childNodes' in node) {
    let out = ''
    for (const child of node.childNodes ?? []) out += textContent(child)
    return out
  }
  return ''
}

function collectElements(root: DefaultTreeAdapterMap['node']): Element[] {
  const out: Element[] = []
  const visit = (node: DefaultTreeAdapterMap['node']): void => {
    if (node.nodeName !== '#text' && node.nodeName !== '#document' && node.nodeName !== '#documentType' && node.nodeName !== '#comment' && 'tagName' in node) {
      const element = node as Element
      out.push(element)
      for (const child of element.childNodes ?? []) visit(child)
    } else if ('childNodes' in node) {
      for (const child of node.childNodes ?? []) visit(child)
    }
  }
  visit(root)
  return out
}

function isDataResourceUrl(value: string): boolean {
  return DATA_URL_PREFIXES.some((prefix) => value.startsWith(prefix))
}

function checkInlineCss(element: Element, css: string, checks: HtmlEntryCheck[]): void {
  const where = `<${element.tagName}>`
  if (/@import/i.test(css)) {
    checks.push({ where, message: 'CSS `@import` is forbidden' })
  }
  const urlMatches = css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)
  for (const match of urlMatches) {
    const url = match[1] ?? ''
    if (!url.startsWith('data:')) {
      checks.push({ where, message: `CSS \`url()\` must reference \`data:\`, found "${url.slice(0, 60)}"` })
    }
  }
}

/**
 * Validate a variant HTML entry against the declared scenario IDs of its
 * manifest. Returns every failed check plus the parsed screen graph.
 */
export function validateHtmlEntry(
  sourceHtml: string,
  declaredScenarioIds: readonly string[],
  options: { strictScenarioDeclaration?: boolean } = {},
): HtmlEntryReport {
  const strictScenarios = options.strictScenarioDeclaration !== false
  const checks: HtmlEntryCheck[] = []
  const document = parse(sourceHtml)
  const elements = collectElements(document)

  // Document structure.
  const hasDoctype = document.childNodes.some((node) => node.nodeName === '#documentType')
  if (!hasDoctype) checks.push({ where: 'document', message: 'Document must start with a doctype' })

  const htmlElement = document.childNodes.find((node): node is Element => node.nodeName === 'html') as Element | undefined
  const lang = htmlElement?.attrs.find((a) => a.name === 'lang')?.value
  if (!lang) checks.push({ where: '<html>', message: '`<html>` must declare a non-empty `lang`' })

  const titles = elements.filter((element) => element.tagName === 'title')
  if (titles.length !== 1 || textContent(titles[0] ?? ({} as Element)).trim() === '') {
    checks.push({ where: '<title>', message: 'Document must contain exactly one `<title>` with non-empty text' })
  }

  const hasViewport = elements.some(
    (element) => element.tagName === 'meta' && attr(element, 'name')?.toLowerCase() === 'viewport' && attr(element, 'content') !== undefined,
  )
  if (!hasViewport) checks.push({ where: '<meta>', message: 'Document must contain `<meta name="viewport" content="…">`' })

  const hasSemanticRoot = elements.some((element) => SEMANTIC_TAGS.has(element.tagName))
  if (!hasSemanticRoot) checks.push({ where: '<body>', message: 'Document must use semantic HTML (`main`, `section`, `nav`, `header`, `footer`, `article`, or `aside`)' })

  // Screen graph.
  const screenElements = elements.filter((element) => attr(element, RUNTIME_ATTRIBUTES.screen) !== undefined)
  const screens: string[] = []
  for (const element of screenElements) {
    const id = attr(element, RUNTIME_ATTRIBUTES.screen) ?? ''
    if (element.tagName !== 'section') {
      checks.push({ where: `<${element.tagName} ${RUNTIME_ATTRIBUTES.screen}>`, message: 'Screens must be `<section>` elements' })
    }
    if (!KEBAB_ID_PATTERN.test(id)) {
      checks.push({ where: `${RUNTIME_ATTRIBUTES.screen}="${id}"`, message: 'Screen ID must be kebab-case' })
    } else if (screens.includes(id)) {
      checks.push({ where: `${RUNTIME_ATTRIBUTES.screen}="${id}"`, message: 'Duplicate screen ID' })
    } else {
      screens.push(id)
    }
  }
  const screenSet = new Set(screens)
  const validationTargets: string[] = []

  const bodyElement = elements.find((element) => element.tagName === 'body')
  const startScreen = bodyElement ? (attr(bodyElement, RUNTIME_ATTRIBUTES.start) ?? null) : null
  if (!bodyElement || startScreen === null) {
    checks.push({ where: '<body>', message: '`<body>` must declare `data-prototype-start="<screen-id>"`' })
  } else if (!KEBAB_ID_PATTERN.test(startScreen)) {
    checks.push({ where: `${RUNTIME_ATTRIBUTES.start}="${startScreen}"`, message: 'Start screen ID must be kebab-case' })
  }

  // Element ids and control names.
  const ids: string[] = []
  for (const element of elements) {
    const id = attr(element, 'id')
    if (id === undefined) continue
    if (!KEBAB_ID_PATTERN.test(id)) {
      checks.push({ where: `id="${id}"`, message: 'Element ID must be kebab-case' })
    } else if (ids.includes(id)) {
      checks.push({ where: `id="${id}"`, message: 'Duplicate element ID' })
    } else {
      ids.push(id)
    }
  }
  const controlNames: string[] = []

  for (const element of elements) {
    if (!CONTROL_NAME_TAGS.has(element.tagName)) continue
    const name = attr(element, 'name')
    if (name === undefined) continue
    if (!KEBAB_ID_PATTERN.test(name)) {
      checks.push({ where: `<${element.tagName} name="${name}">`, message: 'Control name must be kebab-case' })
    } else if (!controlNames.includes(name)) {
      controlNames.push(name)
    }
  }
  const nameSet = new Set(controlNames)
  const idSet = new Set(ids)

  const forms: string[] = elements.filter((element) => element.tagName === 'form' && attr(element, 'id')).map((element) => attr(element, 'id') as string)
  const formSet = new Set(forms)

  // Per-element allow-list and runtime attributes.
  const actionAttributeSet = new Set<string>(ACTION_ATTRIBUTE_NAMES)
  for (const element of elements) {
    const tag = element.tagName
    const where = `<${tag}>`

    if (FORBIDDEN_TAGS.has(tag)) {
      checks.push({ where, message: `Forbidden element \`<${tag}>\`` })
    }
    if (tag === 'meta' && attr(element, 'http-equiv') !== undefined) {
      checks.push({ where: '<meta http-equiv>', message: '`<meta http-equiv>` is forbidden' })
    }
    if (tag === 'button' && attr(element, 'type') !== 'button') {
      checks.push({ where, message: 'Buttons must declare `type="button"`' })
    }

    for (const { name, value } of element.attrs as Attributes) {
      const attrWhere = `${where} ${name}`

      if (/^on[a-z]+$/i.test(name)) {
        checks.push({ where: attrWhere, message: 'Inline event handlers are forbidden' })
      }
      const trimmed = value.trim().toLowerCase()
      if (trimmed.startsWith('javascript:') || trimmed.startsWith('vbscript:') || trimmed.startsWith('data:text/html')) {
        checks.push({ where: attrWhere, message: `Script-scheme URL is forbidden` })
      }
      if (name === 'href' || name === 'xlink:href') {
        if (!value.startsWith('#')) {
          checks.push({ where: attrWhere, message: '`href` must reference a same-document fragment (`#…`)' })
        }
        continue
      }
      if (name === 'style') {
        checkInlineCss(element, value, checks)
        continue
      }
      if (RESOURCE_ATTRIBUTES.has(name)) {
        if (!RESOURCE_TAGS.has(tag) || !isDataResourceUrl(value)) {
          checks.push({ where: attrWhere, message: 'Resource URLs are only allowed as `data:` on image/media/font attributes' })
        }
        continue
      }
      if (NAVIGATION_ATTRIBUTES.has(name)) {
        checks.push({ where: attrWhere, message: `Attribute \`${name}\` is forbidden` })
      }
    }

    if (tag === 'style') {
      checkInlineCss(element, textContent(element), checks)
    }

    // Native control constraints.
    if (tag === 'input') {
      const type = attr(element, 'type') ?? 'text'
      if (!ALLOWED_INPUT_TYPES.includes(type as (typeof ALLOWED_INPUT_TYPES)[number])) {
        checks.push({ where, message: `Input type "${type}" is not allowed` })
      }
      if (attr(element, 'pattern') !== undefined) {
        checks.push({ where, message: 'Input `pattern` is forbidden' })
      }
      if (attr(element, 'step') !== undefined) {
        checks.push({ where, message: 'Input `step` is forbidden' })
      }
      for (const bound of ['min', 'max'] as const) {
        const raw = attr(element, bound)
        if (raw !== undefined && !/^-?[0-9]+(\.[0-9]+)?$/.test(raw.trim())) {
          checks.push({ where, message: `Input \`${bound}\` must be a finite number` })
        }
      }
      const maxlength = attr(element, 'maxlength')
      if (TEXTUAL_INPUT_TYPES.includes(type as (typeof TEXTUAL_INPUT_TYPES)[number])) {
        const limit = Number(maxlength)
        if (maxlength === undefined || !Number.isInteger(limit) || limit < 1 || limit > MAX_TEXTUAL_INPUT_LENGTH) {
          checks.push({ where, message: `Inputs of type "${type}" must set \`maxlength\` between 1 and ${MAX_TEXTUAL_INPUT_LENGTH}` })
        }
      } else if (maxlength !== undefined) {
        checks.push({ where, message: `Inputs of type "${type}" must not set \`maxlength\`` })
      }
      const minlength = attr(element, 'minlength')
      if (minlength !== undefined) {
        const min = Number(minlength)
        const max = maxlength !== undefined ? Number(maxlength) : Number.POSITIVE_INFINITY
        if (!Number.isInteger(min) || min < 0 || min > max) {
          checks.push({ where, message: 'Input `minlength` must be a non-negative integer not above `maxlength`' })
        }
      }
    }
    if (tag === 'textarea') {
      const maxlength = attr(element, 'maxlength')
      const limit = Number(maxlength)
      if (maxlength === undefined || !Number.isInteger(limit) || limit < 1 || limit > MAX_TEXTAREA_LENGTH) {
        checks.push({ where, message: `\`<textarea>\` must set \`maxlength\` between 1 and ${MAX_TEXTAREA_LENGTH}` })
      }
      if (attr(element, 'pattern') !== undefined) {
        checks.push({ where, message: '`<textarea pattern>` is forbidden' })
      }
    }

    // Runtime attributes.
    const actions: string[] = []
    for (const { name, value } of element.attrs as Attributes) {
      if (!name.startsWith(RUNTIME_ATTRIBUTE_PREFIX)) continue
      const attrWhere = `${where} ${name}`
      if (!KNOWN_RUNTIME_ATTRIBUTES.has(name)) {
        checks.push({ where: attrWhere, message: `Unknown runtime attribute "${name}"` })
        continue
      }
      if (name === RUNTIME_ATTRIBUTES.start) {
        if (element.tagName !== 'body') checks.push({ where: attrWhere, message: `${name} is only allowed on \`<body>\`` })
        continue
      }
      if (name === RUNTIME_ATTRIBUTES.screen) {
        if (element.tagName !== 'section') checks.push({ where: attrWhere, message: `${name} is only allowed on \`<section>\`` })
        continue
      }
      if (actionAttributeSet.has(name)) actions.push(name)
      switch (name) {
        case RUNTIME_ATTRIBUTES.go: {
          if (!KEBAB_ID_PATTERN.test(value) || !screenSet.has(value)) {
            checks.push({ where: attrWhere, message: `Transition target "${value}" is not a declared screen` })
          }
          break
        }
        case RUNTIME_ATTRIBUTES.goByScenario: {
          let entries: Array<{ scenarioId: string; screenId: string }>
          try {
            entries = parseScenarioMap(value)
          } catch (e) {
            checks.push({ where: attrWhere, message: (e as Error).message })
            break
          }
          const keys = entries.map((entry) => entry.scenarioId)
          const fallbacks = keys.filter((key) => key === '*')
          if (fallbacks.length !== 1) {
            checks.push({ where: attrWhere, message: 'Scenario map must declare exactly one `*` fallback' })
          }
          const seenKeys = new Set<string>()
          for (const entry of entries) {
            if (seenKeys.has(entry.scenarioId)) {
              checks.push({ where: attrWhere, message: `Duplicate scenario key "${entry.scenarioId}"` })
            }
            seenKeys.add(entry.scenarioId)
            if (strictScenarios && entry.scenarioId !== '*' && !declaredScenarioIds.includes(entry.scenarioId)) {
              checks.push({ where: attrWhere, message: `Scenario "${entry.scenarioId}" is not declared in the manifest` })
            }
            if (!KEBAB_ID_PATTERN.test(entry.screenId) || !screenSet.has(entry.screenId)) {
              checks.push({ where: attrWhere, message: `Transition target "${entry.screenId}" is not a declared screen` })
            }
          }
          break
        }
        case RUNTIME_ATTRIBUTES.back:
        case RUNTIME_ATTRIBUTES.reset: {
          if (value !== '') checks.push({ where: attrWhere, message: `${name} must not carry a value` })
          break
        }
        case RUNTIME_ATTRIBUTES.toggle: {
          if (!idSet.has(value)) {
            checks.push({ where: attrWhere, message: `Toggle target "${value}" is not an element ID in this document` })
          }
          break
        }
        case RUNTIME_ATTRIBUTES.validate: {
          if (!formSet.has(value)) {
            checks.push({ where: attrWhere, message: `Validation target "${value}" is not a \`<form>\` ID in this document` })
          }
          break
        }
        case RUNTIME_ATTRIBUTES.error: {
          if (value.length === 0 || /[\u0000-\u001f\u007f\u2028\u2029]/.test(value) || value.length > 8192) {
            checks.push({ where: attrWhere, message: 'Validation error copy must be non-empty bounded text without control characters' })
          }
          break
        }
        case RUNTIME_ATTRIBUTES.validationFor:
        case RUNTIME_ATTRIBUTES.bind: {
          if (name === RUNTIME_ATTRIBUTES.validationFor && !validationTargets.includes(value)) validationTargets.push(value)
          if (!nameSet.has(value)) {
            checks.push({ where: attrWhere, message: `${name} target "${value}" is not a control name in this document` })
          }
          break
        }
        case RUNTIME_ATTRIBUTES.scenario: {
          if (strictScenarios && !declaredScenarioIds.includes(value)) {
            checks.push({ where: attrWhere, message: `Scenario "${value}" is not declared in the manifest` })
          }
          break
        }
      }
    }
    if (actions.length > 1) {
      checks.push({ where, message: `An action element must carry exactly one action attribute; found ${actions.map((a) => `"${a}"`).join(', ')}` })
    }
    if (actions.length === 1 && element.tagName !== 'button') {
      checks.push({ where, message: 'Runtime actions are only allowed on `<button>` elements' })
    }
  }

  if (startScreen !== null && screenSet.size > 0 && !screenSet.has(startScreen)) {
    checks.push({ where: RUNTIME_ATTRIBUTES.start, message: `Start screen "${startScreen}" is not a declared screen` })
  }

  return { checks, screens, startScreen, controlNames, validationTargets }
}
