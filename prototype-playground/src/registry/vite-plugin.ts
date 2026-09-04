/**
 * Vite plugin exposing `virtual:prototype-registry` and one lazy virtual
 * module per variant. Every repository-provided JSON or HTML payload
 * crosses the code-generation boundary as UTF-8 base64; virtual module
 * IDs use internal ordinals, never user IDs or paths. The plugin watches
 * the four manifest globs, referenced HTML files, `ACTIVE`, and referenced
 * profile-version files, invalidating the registry and triggering a full
 * reload on add/change/delete.
 *
 * Node-only: this plugin and the catalogue it loads never enter the
 * browser bundle; the browser consumes the generated virtual modules.
 */
import { realpathSync } from 'node:fs'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import type { CatalogueResult, PrototypeRecord } from '../contracts'
import { loadRepositoryCatalogue } from './catalogue'

const REGISTRY_ID = 'virtual:prototype-registry'
const RESOLVED_REGISTRY_ID = '\0virtual:prototype-registry'
const VARIANT_PREFIX = 'virtual:prototype-variant/'
const RESOLVED_VARIANT_PREFIX = '\0virtual:prototype-variant/'

export type PrototypeRegistryPluginOptions = {
  repoRoot?: string
  selectedPrototypeId?: string
  eager?: boolean
}

const DECODE_SNIPPET = [
  'function __ppDecode(b64) {',
  '  var bin = atob(b64);',
  '  var bytes = new Uint8Array(bin.length);',
  '  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);',
  '  return new TextDecoder("utf-8").decode(bytes);',
  '}',
].join('\n')

type PluginState = {
  repoRoot: string
  strict: boolean
  cataloguePromise: Promise<CatalogueResult> | null
  variantHtml: string[]
  variantOrdinalByHtml: Map<string, number>
  watchAttached: boolean
}

export default function prototypeRegistryPlugin(options: PrototypeRegistryPluginOptions = {}): Plugin {
  const state: PluginState = {
    repoRoot: '',
    strict: false,
    cataloguePromise: null,
    variantHtml: [],
    variantOrdinalByHtml: new Map(),
    watchAttached: false,
  }
  const eager = options.eager ?? false
  const selectedPrototypeId = options.selectedPrototypeId

  const resolveRepoRoot = (appRoot: string): string => {
    if (options.repoRoot) return path.resolve(options.repoRoot)
    const override = process.env.PROTOTYPE_PLAYGROUND_ROOT
    if (override) return path.resolve(override)
    return realpathSync(path.resolve(appRoot, '..'))
  }

  const loadCatalogue = (server?: ViteDevServer): Promise<CatalogueResult> => {
    if (!state.cataloguePromise) {
      state.cataloguePromise = loadRepositoryCatalogue(state.repoRoot, {
        includeExamples: true,
        selectedPrototypeId,
      }).then((catalogue) => {
        if (state.strict && catalogue.totals.errors > 0) {
          const first = catalogue.diagnostics[0]
          throw new Error(
            `Prototype registry validation failed with ${catalogue.totals.errors} error(s): ${first ? `${first.path}: ${first.message}` : 'unknown'}`,
          )
        }
        if (server && !state.watchAttached) {
          state.watchAttached = true
          attachWatcher(server)
        }
        return catalogue
      })
      state.cataloguePromise.catch(() => {
        state.cataloguePromise = null
      })
    }
    return state.cataloguePromise
  }

  const variantModuleIds = (): string[] =>
    state.variantHtml.map((_, ordinal) => `${RESOLVED_VARIANT_PREFIX}${ordinal}`)

  const invalidate = (server: ViteDevServer): void => {
    const ids = [RESOLVED_REGISTRY_ID, ...variantModuleIds()]
    state.cataloguePromise = null
    state.variantHtml = []
    state.variantOrdinalByHtml = new Map()
    for (const id of ids) {
      const mod = server.moduleGraph.getModuleById(id)
      if (mod) server.moduleGraph.invalidateModule(mod)
    }
    server.ws.send({ type: 'full-reload' })
  }

  const isRegistryRelevant = (file: string): boolean => {
    const rel = path.relative(state.repoRoot, file)
    if (rel.startsWith('..')) return false
    const posix = rel.split(path.sep).join('/')
    if (posix === 'design-system/profiles/ACTIVE') return true
    if (posix.startsWith('design-system/profiles/')) return /\.(json|css)$/.test(posix)
    if (posix.startsWith('design-system/')) return false
    if (/^(requirements|examples)\//.test(posix)) return /\.(json|html|md|pen)$/.test(posix)
    return false
  }

  const attachWatcher = (server: ViteDevServer): void => {
    server.watcher.add([
      path.join(state.repoRoot, 'requirements'),
      path.join(state.repoRoot, 'examples'),
      path.join(state.repoRoot, 'design-system', 'profiles'),
    ])
    for (const event of ['change', 'add', 'unlink'] as const) {
      server.watcher.on(event, (file: string) => {
        if (isRegistryRelevant(file)) invalidate(server)
      })
    }
  }

  /**
   * Assign every record variant an internal ordinal. Ordinals are stable
   * within one registry generation and never encode user IDs or paths.
   */
  const collectVariants = async (catalogue: CatalogueResult): Promise<Array<Record<string, number>>> => {
    const perRecord: Array<Record<string, number>> = []
    for (const record of catalogue.records) {
      const ordinals: Record<string, number> = {}
      for (const variant of record.variants) {
        const html = await record.loadVariant(variant.id)
        const known = state.variantOrdinalByHtml.get(html)
        if (known !== undefined) {
          ordinals[variant.id] = known
        } else {
          const ordinal = state.variantHtml.length
          state.variantHtml.push(html)
          state.variantOrdinalByHtml.set(html, ordinal)
          ordinals[variant.id] = ordinal
        }
      }
      perRecord.push(ordinals)
    }
    return perRecord
  }

  const encode = (value: string): string => JSON.stringify(Buffer.from(value, 'utf8').toString('base64'))

  const generateVariantModule = (html: string): string =>
    `${DECODE_SNIPPET}\nconst ENCODED = ${encode(html)}\nexport default __ppDecode(ENCODED)\n`

  const generateRegistryModule = async (catalogue: CatalogueResult, isEager: boolean): Promise<string> => {
    const perRecord = await collectVariants(catalogue)
    const { records, ...rest } = catalogue
    const summaries = records.map((record: PrototypeRecord, index: number) => {
      const { loadVariant, ...summary } = record
      void loadVariant
      return { ...summary, variantOrdinals: perRecord[index] ?? {} }
    })
    const payload = JSON.stringify({ ...rest, records: summaries })
    const loaders = state.variantHtml.map((_, ordinal) => `${ordinal}: () => import('${VARIANT_PREFIX}${ordinal}')`)
    return [
      DECODE_SNIPPET,
      `const PAYLOAD = __ppDecode(${encode(payload)})`,
      'const data = JSON.parse(PAYLOAD)',
      `const variantLoaders = { ${loaders.join(', ')} }`,
      isEager
        ? 'const preloaded = await Promise.all(Object.keys(variantLoaders).map((key) => variantLoaders[Number(key)]().then((m) => m.default)))'
        : 'const preloaded = null',
      'const records = data.records.map((record) => {',
      '  const variantOrdinals = record.variantOrdinals',
      '  const summary = { ...record }',
      '  delete summary.variantOrdinals',
      '  return {',
      '    ...summary,',
      '    loadVariant(variantId) {',
      '      const ordinal = variantOrdinals[variantId]',
      `      if (ordinal === undefined) return Promise.reject(new Error('Unknown variant "' + variantId + '"'))`,
      '      if (preloaded) return Promise.resolve(preloaded[ordinal])',
      '      return variantLoaders[ordinal]().then((m) => m.default)',
      '    },',
      '  }',
      '})',
      'export default { ...data, records }',
      '',
    ].join('\n')
  }

  return {
    name: 'prototype-registry',
    enforce: 'pre',

    configResolved(config) {
      state.repoRoot = resolveRepoRoot(config.root)
      state.strict = config.command === 'build'
    },

    resolveId(id) {
      if (id === REGISTRY_ID) return RESOLVED_REGISTRY_ID
      if (id.startsWith(VARIANT_PREFIX)) return `\0${id}`
      return null
    },

    async load(id) {
      if (id === RESOLVED_REGISTRY_ID) {
        const catalogue = await loadCatalogue()
        return await generateRegistryModule(catalogue, eager)
      }
      if (id.startsWith(RESOLVED_VARIANT_PREFIX)) {
        const catalogue = await loadCatalogue()
        // Ensure ordinals exist before answering a variant module request.
        await collectVariants(catalogue)
        const ordinal = Number(id.slice(RESOLVED_VARIANT_PREFIX.length))
        const html = state.variantHtml[ordinal]
        if (html === undefined) throw new Error(`Unknown variant module ordinal ${ordinal}`)
        return generateVariantModule(html)
      }
      return null
    },

    configureServer(server) {
      state.strict = false
      loadCatalogue(server).catch((e: unknown) => {
        server.config.logger.error(`prototype-registry: ${(e as Error).message}`)
      })
    },
  }
}
