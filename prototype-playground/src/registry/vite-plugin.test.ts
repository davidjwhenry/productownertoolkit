import { describe, expect, it } from 'vitest'
import prototypeRegistryPlugin from './vite-plugin'
import { loadRepositoryCatalogue } from './catalogue'
import { makeFixtureRepo, validEntryHtml, type FixtureRepo } from '../testing/make-fixture-repo'

const RESOLVED_REGISTRY_ID = '\0virtual:prototype-registry'
const RESOLVED_VARIANT_PREFIX = '\0virtual:prototype-variant/'

type LoadablePlugin = {
  resolveId(id: string): string | null
  load(id: string): Promise<string | null>
}

async function withPlugin(fn: (plugin: LoadablePlugin, repo: FixtureRepo) => Promise<void>): Promise<void> {
  const repo = await makeFixtureRepo()
  const plugin = prototypeRegistryPlugin({ repoRoot: repo.root }) as unknown as LoadablePlugin
  // configResolved normally sets these; emulate the build path.
  await (plugin as unknown as { configResolved(config: { command: string; root: string }): Promise<void> }).configResolved({
    command: 'serve',
    root: process.cwd(),
  })
  try {
    await fn(plugin, repo)
  } finally {
    await repo.cleanup()
  }
}

function extractBase64(module: string, marker: string): string {
  const match = module.match(new RegExp(`${marker} = (?:__ppDecode\\()?"([A-Za-z0-9+/=]+)"\\)?`))
  if (!match?.[1]) throw new Error(`marker ${marker} not found`)
  return match[1]
}
describe('prototypeRegistryPlugin', () => {
  it('resolves the registry and variant virtual ids', async () => {
    await withPlugin(async (plugin) => {
      expect(plugin.resolveId('virtual:prototype-registry')).toBe(RESOLVED_REGISTRY_ID)
      expect(plugin.resolveId('virtual:prototype-variant/3')).toBe(`\0virtual:prototype-variant/3`)
      expect(plugin.resolveId('src/main.tsx')).toBeNull()
    })
  })

  it('emits the catalogue as base64 with ordinal variant modules', async () => {
    await withPlugin(async (plugin, repo) => {
      const registryModule = (await plugin.load(RESOLVED_REGISTRY_ID)) as string
      // No repository text crosses the boundary unencoded.
      expect(registryModule).not.toContain('Demo prototype')
      expect(registryModule).not.toContain('demo-feature')
      expect(registryModule).not.toContain('<!DOCTYPE')
      // Module ids are internal ordinals only.
      expect(registryModule).toContain("import('virtual:prototype-variant/0')")
      expect(registryModule).not.toContain('virtual:prototype-variant/demo')

      const payload = JSON.parse(Buffer.from(extractBase64(registryModule, 'PAYLOAD'), 'base64').toString('utf8'))
      expect(payload.records).toHaveLength(1)
      expect(payload.records[0]).toMatchObject({ id: 'demo', origin: 'example' })
      expect(payload.records[0].variantOrdinals).toEqual({ focused: 0 })

      const variantModule = (await plugin.load(`${RESOLVED_VARIANT_PREFIX}0`)) as string
      const html = Buffer.from(extractBase64(variantModule, 'ENCODED'), 'base64').toString('utf8')
      expect(html).toBe(validEntryHtml())
      await expect(plugin.load(`${RESOLVED_VARIANT_PREFIX}99`)).rejects.toThrow('Unknown variant module ordinal')
      void repo
    })
  })

  it('agrees with the direct catalogue load', async () => {
    await withPlugin(async (plugin, repo) => {
      const registryModule = (await plugin.load(RESOLVED_REGISTRY_ID)) as string
      const payload = JSON.parse(Buffer.from(extractBase64(registryModule, 'PAYLOAD'), 'base64').toString('utf8'))
      const catalogue = await loadRepositoryCatalogue(repo.root)
      expect(payload.totals).toEqual(catalogue.totals)
      expect(payload.activeProfile).toEqual(catalogue.activeProfile)
      expect(payload.records[0].id).toBe(catalogue.records[0]?.id)
    })
  })
})
