import { describe, expect, it } from 'vitest'
import { buildRevisionBrief, resolveSelection, selectionToQuery, type Selection } from './useSelectionState'
import type { CatalogueResult, PrototypeRecord, ResolvedDesignProfile } from '../contracts'

function makeRecord(): PrototypeRecord {
  return {
    origin: 'requirement',
    classification: null,
    feature: 'demo-feature',
    manifestPath: 'examples/demo-feature/prototypes/demo/prototype.json',
    id: 'demo',
    title: 'Demo',
    summary: 'Fixture',
    revision: 1,
    source: { prd: 'examples/demo-feature/prd/demo-feature-prd.md', requirementIds: ['AF.1'] },
    brief: { primaryUser: 'Customer', job: 'Save', journey: 'Setup', decision: 'Speed vs trust' },
    variants: [
      {
        id: 'focused',
        label: 'Focused',
        hypothesis: 'Controls up front',
        tradeOffs: ['Less context'],
        entry: 'examples/demo-feature/prototypes/demo/variants/focused.html',
        screens: [
          { id: 'overview', label: 'Overview', order: 1, scenarioId: 'happy-path', prdRefs: [{ section: '3.1', requirementIds: [] }] },
          { id: 'review', label: 'Review', order: 2, scenarioId: 'happy-path', prdRefs: [{ section: '3.1', requirementIds: ['AF.1'] }] },
        ],
      },
      {
        id: 'guided',
        label: 'Guided',
        hypothesis: 'Steps build trust',
        tradeOffs: ['Slower'],
        entry: 'examples/demo-feature/prototypes/demo/variants/guided.html',
        screens: [
          { id: 'overview', label: 'Overview', order: 1, scenarioId: 'happy-path', prdRefs: [{ section: '3.1', requirementIds: [] }] },
        ],
      },
    ],
    surfaces: ['desktop', 'ios'],
    scenarios: [
      { id: 'happy-path', label: 'Happy', description: 'Works', requirementIds: ['AF.1'] },
      { id: 'validation-error', label: 'Validation', description: 'Fails', requirementIds: ['AF.1'] },
    ],
    defaults: { variant: 'focused', surface: 'desktop', scenario: 'happy-path', theme: 'light' },
    designSystem: { id: 'default', version: 'v001', fingerprint: 'sha256:0000000000000000000000000000000000000000000000000000000000000000', currentness: 'active' },
    companions: [],
    prototypeOnly: ['Fixture data only'],
    prdMap: { url: null, sections: [] },
    designNotes: [],
    amendments: [],
    loadVariant: () => Promise.reject(new Error('unused')),
  }
}

function makeCatalogue(): CatalogueResult {
  const activeProfile: ResolvedDesignProfile = {
    id: 'default',
      version: 'v001',
      name: 'Default',
      fingerprint: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      defaultTheme: 'light',
      themes: [
        { id: 'light', label: 'Light' },
        { id: 'dark', label: 'Dark' },
      ],
      runtimeCssPath: 'design-system/profiles/v001/tokens.css',
      componentCataloguePath: 'design-system/profiles/v001/components.json',
      assetCataloguePath: 'design-system/profiles/v001/assets.json',
  }
  return {
    activeProfile,
    profiles: { 'default@v001': activeProfile },
    records: [makeRecord()],
    diagnostics: [],
    totals: { errors: 0, warnings: 0 },
  }
}

describe('resolveSelection', () => {
  it('falls back to manifest defaults for unknown query values with warnings', () => {
    const resolution = resolveSelection('?prototype=ghost&variant=zzz&surface=tv&scenario=zzz&theme=zzz&compare=zzz', makeCatalogue())
    expect(resolution.selection).toEqual({
      prototypeId: 'demo',
      variantId: 'focused',
      surfaceId: 'desktop',
      scenarioId: 'happy-path',
      themeId: 'light',
      screenId: null,
      compareVariantId: null,
      showExamples: false,
    })
    expect(resolution.warnings.map((w) => w.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Unknown prototype "ghost"'),
        expect.stringContaining('Unknown variant "zzz"'),
        expect.stringContaining('Unknown surface "tv"'),
        expect.stringContaining('Unknown scenario "zzz"'),
        expect.stringContaining('Unknown theme "zzz"'),
        expect.stringContaining('Unknown compare variant "zzz"'),
      ]),
    )
  })

  it('resolves valid query values and hides compare against the active variant', () => {
    const resolution = resolveSelection('?prototype=demo&variant=guided&surface=ios&scenario=happy-path&theme=dark&compare=guided&examples=1', makeCatalogue())
    expect(resolution.warnings).toEqual([])
    expect(resolution.selection).toMatchObject({ variantId: 'guided', surfaceId: 'ios', themeId: 'dark', compareVariantId: null, showExamples: true })
    const compared = resolveSelection('?prototype=demo&variant=focused&compare=guided', makeCatalogue())
    expect(compared.selection.compareVariantId).toBe('guided')
  })

  it('resolves no record when examples are hidden and no requirement prototypes exist', () => {
    const exampleOnlyCatalogue: CatalogueResult = { ...makeCatalogue(), records: [{ ...makeRecord(), origin: 'example' }] }
    const hidden = resolveSelection('?prototype=demo', exampleOnlyCatalogue)
    expect(hidden.record).toBeNull()
    expect(hidden.selection.prototypeId).toBe('')
    const shown = resolveSelection('?prototype=demo&examples=1', exampleOnlyCatalogue)
    expect(shown.record?.id).toBe('demo')
  })
})

describe('buildRevisionBrief', () => {
  it('renders the exact template with the current selection', () => {
    const selection: Selection = {
      prototypeId: 'savings-automation',
      variantId: 'focused-control',
      surfaceId: 'ios',
      scenarioId: 'validation-error',
      themeId: 'dark',
      screenId: 'configure',
      compareVariantId: null,
      showExamples: true,
    }
    expect(buildRevisionBrief(selection, 'examples/example-feature/prototypes/savings-automation/prototype.json')).toBe(
      `Revise prototype \`savings-automation\` at \`examples/example-feature/prototypes/savings-automation/prototype.json\`.
Current view: variant \`focused-control\`, surface \`ios\`, scenario \`validation-error\`, screen \`configure\`, theme \`dark\`.
Feedback: [describe the requested change]
Preserve the other declared variants and scenarios, keep the pinned design profile unless explicitly changing it, and run \`npm run validate\` from \`prototype-playground/\`.`,
    )
  })
})

describe('selectionToQuery', () => {
  it('round-trips through resolveSelection', () => {
    const selection: Selection = {
      prototypeId: 'demo',
      variantId: 'guided',
      surfaceId: 'ios',
      scenarioId: 'happy-path',
      themeId: 'dark',
      screenId: 'overview',
      compareVariantId: 'focused',
      showExamples: true,
    }
    const query = selectionToQuery(selection)
    expect(query).toContain('compare=focused')
    expect(query).toContain('examples=1')
    expect(query).toContain('screen=overview')
    const resolution = resolveSelection(query, makeCatalogue())
    expect(resolution.warnings).toEqual([])
    expect(resolution.selection).toEqual(selection)
  })

  it('drops a screen declared only by another variant with a warning', () => {
    const resolution = resolveSelection('?prototype=demo&variant=guided&screen=review', makeCatalogue())
    expect(resolution.selection.screenId).toBeNull()
    expect(resolution.warnings.map((w) => w.message)).toEqual([expect.stringContaining('Unknown screen "review"')])
  })

  it('omits the screen parameter when the selection has none', () => {
    expect(selectionToQuery({
      prototypeId: 'demo',
      variantId: 'focused',
      surfaceId: 'desktop',
      scenarioId: 'happy-path',
      themeId: 'light',
      screenId: null,
      compareVariantId: null,
      showExamples: false,
    })).not.toContain('screen=')
  })
})
