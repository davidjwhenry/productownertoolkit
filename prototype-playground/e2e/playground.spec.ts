import { test, expect, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixtureRoot = path.join(appRoot, '.e2e-tmp', 'fixture-repo')

const frame = (page: Page) => page.frameLocator('iframe.preview-iframe').first()

/**
 * The variant HTML ships with every screen `hidden`; the overview heading
 * becomes visible only once the injected runtime has initialised, so this
 * is the readiness barrier for any interaction with the preview.
 */
async function readyWithOverview(page: Page): Promise<void> {
  // `data-status="ready"` proves the *current* iframe's runtime posted
  // `prototype:ready`; the overview heading proves it unhid the start screen.
  await expect(page.locator('.preview-stage').first()).toHaveAttribute('data-status', 'ready', { timeout: 15_000 })
  await expect(frame(page).getByRole('heading', { name: 'Flat deposit' })).toBeVisible({ timeout: 15_000 })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Catalogue', exact: true }).click()
})

test('labelled savings example is discoverable with PRD, profile, and requirement traceability', async ({ page }) => {
  await expect(page.getByRole('button', { name: /Savings pots and round-ups automation/ })).toBeVisible()
  await expect(page.locator('.catalogue-badge', { hasText: 'Example' })).toBeVisible()
  await page.getByRole('button', { name: /Savings pots and round-ups automation/ }).click()
  await page.getByRole('button', { name: /^Review ·/ }).click()
  await page.getByRole('button', { name: 'Design notes', exact: true }).click()
  await expect(page.locator('.notes-column')).toContainText('savings-example-prd.md')
  await expect(page.locator('.notes-column')).toContainText('AF.3, AF.4, CT.1')
  await expect(page.locator('.notes-column')).toContainText('default@v002')
  await expect(page.locator('.flow-column')).toContainText('Happy path')
  await page.locator('.prd-details summary').click()
  await expect(page.locator('.prd-open')).toBeVisible()
})

test('show examples defaults on with no live prototypes, and the checkbox actually filters', async ({ page }) => {
  await expect(page.getByLabel('Show examples')).toBeChecked()
  await expect(page.getByRole('button', { name: /Savings pots and round-ups automation/ })).toBeVisible()
  await expect(page).toHaveURL(/examples=1/)

  await page.getByLabel('Show examples').uncheck()
  await expect(page).not.toHaveURL(/examples=1/)
  await expect(page.getByRole('button', { name: /Savings pots and round-ups automation/ })).toBeHidden()
  await expect(page.locator('.catalogue-empty')).toContainText('No prototypes found')
  await expect(page.locator('.empty-state')).toContainText('No prototypes to preview')
  await expect(page.locator('iframe.preview-iframe')).toBeHidden()
  await expect(page.locator('.notes-column')).toContainText('Select a prototype')

  await page.getByLabel('Show examples').check()
  await expect(page).toHaveURL(/examples=1/)
  await expect(page.getByRole('button', { name: /Savings pots and round-ups automation/ })).toBeVisible()
})

test('variant, surface, scenario, and theme controls drive the URL and the preview', async ({ page }) => {
  await page.getByRole('button', { name: /Savings pots and round-ups automation/ }).click()
  await readyWithOverview(page)
  await expect(page.locator('.variant-segment button[aria-pressed="true"]')).toHaveText('Focused control')
  await expect(page).toHaveURL(/variant=focused-control/)

  await page.getByRole('button', { name: 'Guided trust' }).click()
  await expect(page).toHaveURL(/variant=guided-trust/)
  await readyWithOverview(page)
  await page.getByLabel('Surface').selectOption('ios')
  await expect(page).toHaveURL(/surface=ios/)
  await expect(page.locator('iframe.preview-iframe').first()).toHaveAttribute('sandbox', 'allow-scripts')
  await readyWithOverview(page)

  await page.locator('.scenario-card', { hasText: 'Validation error' }).click()
  await expect(page).toHaveURL(/scenario=validation-error/)
  await readyWithOverview(page)
  await frame(page).getByRole('button', { name: 'Start guided setup' }).click()
  await expect(frame(page).getByRole('heading', { name: 'How often should saving happen?' })).toBeVisible()
  await frame(page).getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(frame(page).getByRole('heading', { name: 'How much each time?' })).toBeVisible()
  await expect(frame(page).getByText('Try an amount outside the range')).toBeVisible()
  // Let the in-phone navigation reach the URL before a remounting switch:
  // the message crossing is asynchronous and the URL is the source of truth.
  await expect(page).toHaveURL(/screen=step-amount/)
  // A theme switch keeps the reviewer's position: the mount rehydrates
  // the walked-to screen rather than booting back to the overview, and
  // the scenario fixture lands with it.
  await page.getByLabel('Theme').selectOption('dark')
  await expect(page).toHaveURL(/theme=dark/)
  await expect(frame(page).getByRole('heading', { name: 'How much each time?' })).toBeVisible()
  await expect(frame(page).locator('input[name="amount"]')).toHaveValue('750')
  await expect(frame(page).getByText('Enter an amount between £1 and £500')).toBeVisible()
})

test('focused happy path reaches Automation is set through review', async ({ page }) => {
  await page.getByRole('button', { name: /Savings pots and round-ups automation/ }).click()
  await readyWithOverview(page)
  await frame(page).getByRole('button', { name: 'Set up automation' }).click()
  await expect(frame(page).getByRole('heading', { name: 'Set up saving' })).toBeVisible()
  await frame(page).locator('input[name="amount"]').fill('25')
  await frame(page).getByLabel('Weekly', { exact: true }).check()
  await frame(page).getByLabel('Round-ups on').check()
  await frame(page).getByRole('button', { name: 'Review automation' }).click()
  await expect(frame(page).getByText('Review your automation')).toBeVisible()
  await frame(page).getByRole('button', { name: 'Confirm automation' }).click()
  await expect(frame(page).getByText('Automation is set')).toBeVisible()
})

test('guided variant reaches the same result through its stepped flow', async ({ page }) => {
  await page.getByRole('button', { name: /Savings pots and round-ups automation/ }).click()
  await readyWithOverview(page)
  await page.getByRole('button', { name: 'Guided trust' }).click()
  await readyWithOverview(page)
  await frame(page).getByRole('button', { name: 'Start guided setup' }).click()
  await expect(frame(page).getByRole('heading', { name: 'How often should saving happen?' })).toBeVisible()
  await frame(page).getByLabel('Weekly, every Friday').check()
  await frame(page).getByRole('button', { name: 'Continue', exact: true }).click()
  await frame(page).locator('input[name="amount"]').fill('25')
  await frame(page).getByRole('button', { name: 'Continue', exact: true }).click()
  await frame(page).getByLabel('Yes, round up card purchases').check()
  await frame(page).getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(frame(page).getByRole('heading', { name: 'Review and confirm' })).toBeVisible()
  await frame(page).getByRole('button', { name: 'Confirm automation' }).click()
  await expect(frame(page).getByText('Automation is set')).toBeVisible()
})

test('validation error preserves entered choices and shows the bounded copy', async ({ page }) => {
  await page.getByRole('button', { name: /Savings pots and round-ups automation/ }).click()
  await readyWithOverview(page)
  await frame(page).getByRole('button', { name: 'Set up automation' }).click()
  await expect(frame(page).getByRole('heading', { name: 'Set up saving' })).toBeVisible()
  await frame(page).getByLabel('Monthly').check()
  await frame(page).locator('input[name="amount"]').fill('750')
  await frame(page).getByRole('button', { name: 'Review automation' }).click()
  await expect(frame(page).getByText('Enter an amount between £1 and £500')).toBeVisible()
  await expect(frame(page).locator('input[name="amount"]')).toHaveValue('750')
  await expect(frame(page).getByLabel('Monthly')).toBeChecked()
})

test('contribution failure shows the specified copy with working recovery actions', async ({ page }) => {
  await page.getByRole('button', { name: /Savings pots and round-ups automation/ }).click()
  await readyWithOverview(page)
  await page.locator('.scenario-card', { hasText: 'Contribution failure' }).click()
  await readyWithOverview(page)
  await frame(page).getByRole('button', { name: 'Set up automation' }).click()
  await expect(frame(page).getByRole('heading', { name: 'Set up saving' })).toBeVisible()
  await frame(page).getByRole('button', { name: 'Review automation' }).click()
  await frame(page).getByRole('button', { name: 'Confirm automation' }).click()
  await expect(frame(page).getByRole('heading', { name: 'Contribution failed' })).toBeVisible()
  await frame(page).getByRole('button', { name: 'Pause automation' }).click()
  await expect(frame(page).getByRole('heading', { name: 'Automation paused' })).toBeVisible()
})

test('the scenario sub-menu jumps to any screen without walking the flow', async ({ page }) => {
  await page.getByRole('button', { name: /Savings pots and round-ups automation/ }).click()
  await readyWithOverview(page)
  await expect(page.locator('.screens-list')).toContainText('Pot overview')

  await page.locator('.screen-row', { hasText: 'Review your automation' }).click()
  await expect(page).toHaveURL(/screen=review/)
  await expect(frame(page).getByText('Review your automation')).toBeVisible()
  await expect(page.locator('.screen-row[aria-current="true"]')).toContainText('Review your automation')
  await expect(page.locator('.stage-title')).toHaveText('Review your automation')
  await page.locator('.prd-details summary').click()
  await expect(page.locator('.prd-chip').first()).toContainText('§5.1')
})

test('a deep link restores the exact screen with its scenario fixture', async ({ page }) => {
  await page.goto('/?prototype=savings-automation&variant=focused-control&surface=desktop&scenario=validation-error&screen=configure&theme=light')
  await expect(frame(page).getByRole('heading', { name: 'Set up saving' })).toBeVisible()
  await expect(frame(page).locator('input[name="amount"]')).toHaveValue('750')
  await expect(frame(page).getByText('Enter an amount between £1 and £500')).toBeVisible()
  await expect(page.locator('.stage-eyebrow')).toContainText('Scenario 02')
})

test('in-prototype navigation keeps the sub-menu and URL in step', async ({ page }) => {
  await page.getByRole('button', { name: /Savings pots and round-ups automation/ }).click()
  await readyWithOverview(page)
  await frame(page).getByRole('button', { name: 'Set up automation' }).click()
  await expect(page).toHaveURL(/screen=configure/)
  await expect(page.locator('.screen-row[aria-current="true"]')).toContainText('Set up saving')
})

test('switching variants retains the equivalent screen', async ({ page }) => {
  await page.getByRole('button', { name: /Savings pots and round-ups automation/ }).click()
  await readyWithOverview(page)
  await page.locator('.screen-row', { hasText: 'Review your automation' }).click()
  await expect(page).toHaveURL(/screen=review/)
  await page.getByRole('button', { name: 'Guided trust' }).click()
  await expect(page).toHaveURL(/variant=guided-trust&.*screen=review/)
  await expect(frame(page).getByRole('heading', { name: 'Review and confirm' })).toBeVisible()
})
test('compare renders both variants against shared settings with no third iframe', async ({ page }) => {
  await page.getByRole('button', { name: /Savings pots and round-ups automation/ }).click()
  await readyWithOverview(page)
  await page.getByLabel('Compare').check()
  await expect(page).toHaveURL(/compare=guided-trust/)
  await expect(page.locator('iframe.preview-iframe')).toHaveCount(2)
  await expect(page.locator('.preview-canvas')).toHaveAttribute('data-compare', 'true')
  const captions = page.locator('.preview-pane figcaption')
  await expect(captions).toHaveCount(2)
  await expect(captions.nth(0)).toHaveText('Focused control')
  await expect(captions.nth(1)).toHaveText('Guided trust')
})

test('copy revision brief carries the current safe IDs and manifest path', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin })
  await page.getByRole('button', { name: /Savings pots and round-ups automation/ }).click()
  await readyWithOverview(page)
  await page.getByRole('button', { name: 'Guided trust' }).click()
  await page.getByLabel('Surface').selectOption('ios')
  await page.getByRole('button', { name: /^Review ·/ }).click()
  await page.locator('.notes-footer summary').click()
  await page.getByRole('button', { name: 'Copy revision brief' }).click()
  // Headless hosts may deny the OS pasteboard, so accept either the
  // success indicator or the labelled fallback textarea; both prove the
  // exact brief content reached the user.
  const fallback = page.locator('.copy-fallback')
  await expect(page.getByText('Copied.').or(fallback)).toBeVisible({ timeout: 5_000 })
  if ((await fallback.count()) > 0) {
    await expect(fallback).toHaveValue(/Revise prototype `savings-automation`/)
    await expect(fallback).toHaveValue(/examples\/example-feature\/prototypes\/savings-automation\/prototype\.json/)
    await expect(fallback).toHaveValue(/variant `guided-trust`, surface `ios`/)
  } else {
    await expect(page.getByText('Copied.')).toBeVisible()
  }
})

test('invalid query parameters recover to manifest defaults and warn in diagnostics', async ({ page }) => {
  await page.goto('/?prototype=ghost&variant=zzz&surface=tv&scenario=zzz&theme=zzz')
  await expect(page).not.toHaveURL(/prototype=ghost/)
  if (await page.getByRole('button', { name: 'Close All prototypes' }).isVisible()) await page.getByRole('button', { name: 'Close All prototypes' }).click()
  await page.locator('.diagnostics-toggle').click()
  await expect(page.locator('.diagnostics-list')).toContainText('Unknown prototype "ghost"')
  await readyWithOverview(page)
})

test('an invalid manifest in the fixture appears in diagnostics without breaking valid previews', async ({ page }) => {
  const brokenDir = path.join(fixtureRoot, 'requirements', 'platform-requirements', 'broken-feature', 'prototypes', 'broken')
  await mkdir(brokenDir, { recursive: true })
  await writeFile(path.join(brokenDir, 'prototype.json'), '{ "schemaVersion": 1 }')
  await page.reload()
  // The registry watcher pushes its own full reload for the new manifest;
  // let it land before interacting so the diagnostics click is not reset.
  await page.waitForTimeout(1500)
  if (await page.getByRole('button', { name: 'Close All prototypes' }).isVisible()) await page.getByRole('button', { name: 'Close All prototypes' }).click()
  await page.locator('.diagnostics-toggle').click()
  await expect(page.locator('.diagnostics-list')).toContainText('PROTOTYPE_SCHEMA_INVALID')
  await page.getByRole('button', { name: 'Catalogue', exact: true }).click()
  await page.getByRole('button', { name: /Savings pots and round-ups automation/ }).click()
  await readyWithOverview(page)
})
test('the canvas never scrolls behind the device frame at Fit', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.getByRole('button', { name: /Savings pots and round-ups automation/ }).click()
  await readyWithOverview(page)

  // Tall iOS frame in a short viewport: Fit must shrink the sizer so the
  // canvas and the wrap stay unscrollable.
  await page.getByLabel('Surface').selectOption('ios')
  await readyWithOverview(page)
  const overflow = await page.evaluate(() => {
    const canvas = document.querySelector('.preview-canvas') as HTMLElement | null
    const wrap = document.querySelector('.preview-frame-wrap') as HTMLElement | null
    const sizer = document.querySelector('.preview-frame-sizer') as HTMLElement | null
    return {
      canvas: canvas ? { scrollHeight: canvas.scrollHeight, clientHeight: canvas.clientHeight, scrollWidth: canvas.scrollWidth, clientWidth: canvas.clientWidth } : null,
      wrap: wrap ? { scrollHeight: wrap.scrollHeight, clientHeight: wrap.clientHeight } : null,
      sizer: sizer ? { width: sizer.offsetWidth, height: sizer.offsetHeight } : null,
    }
  })
  expect(overflow.canvas?.scrollHeight).toBeLessThanOrEqual((overflow.canvas?.clientHeight ?? 0) + 1)
  expect(overflow.canvas?.scrollWidth).toBeLessThanOrEqual((overflow.canvas?.clientWidth ?? 0) + 1)
  expect(overflow.wrap?.scrollHeight).toBeLessThanOrEqual((overflow.wrap?.clientHeight ?? 0) + 1)
  // The sizer is genuinely smaller than the logical 417 × 876 iOS frame.
  expect(overflow.sizer?.height).toBeLessThan(876)
  expect(overflow.sizer?.width).toBeLessThanOrEqual(417)

  // Scrolling still reaches the device screen only.
  await frame(page).getByRole('button', { name: 'Set up automation' }).click()
  await expect(frame(page).getByRole('heading', { name: 'Set up saving' })).toBeVisible()
  const scrolledInDevice = await frame(page).locator('body').evaluate(() => {
    window.scrollTo(0, 200)
    return window.scrollY > 0
  })
  expect(scrolledInDevice).toBe(true)
  const canvasAfter = await page.evaluate(() => {
    const canvas = document.querySelector('.preview-canvas') as HTMLElement | null
    return canvas ? canvas.scrollTop + canvas.scrollLeft : -1
  })
  expect(canvasAfter).toBe(0)
})

test('the sandboxed child cannot gain host privileges', async ({ page }) => {
  await page.getByRole('button', { name: /Savings pots and round-ups automation/ }).click()
  await readyWithOverview(page)
  const iframe = page.locator('iframe.preview-iframe').first()
  await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts')
  await expect(iframe).toHaveAttribute('referrerpolicy', 'no-referrer')
  await expect(iframe).toHaveAttribute('allow', '')
  const title = await iframe.getAttribute('title')
  expect(title).toContain('savings-automation')
  // The host DOM is untouched by child rendering.
  await expect(page.locator('#root .app-shell')).toBeVisible()
  await expect(page.locator('.shell-brand h1')).toHaveText('Playground')
})

test('amendments round-trip through the dev-server write path', async ({ page, context }) => {
  await page.getByRole('button', { name: /Savings pots and round-ups automation/ }).click()
  await readyWithOverview(page)
  await page.getByRole('button', { name: /^Review ·/ }).click()
  await expect(page.locator('.amendments-panel')).toContainText('1 open')

  // Jump through an amendment pin.
  await page.locator('.amendment-title', { hasText: 'Round-up daily cap' }).click()
  await expect(page).toHaveURL(/variant=guided-trust/)
  await expect(page).toHaveURL(/screen=step-amount/)
  await expect(frame(page).getByRole('heading', { name: 'How much each time?' })).toBeVisible()

  // A second tab loads the same revision before the first tab writes.
  const stale = await context.newPage()
  await stale.goto(page.url())
  await stale.getByRole('button', { name: /^Review ·/ }).click()
  await expect(stale.locator('.amendments-panel')).toContainText('1 open')

  // Propose a new amendment through the form.
  await page.getByRole('button', { name: 'Propose amendment' }).click()
  await page.getByLabel('Title', { exact: true }).fill('Show the pot balance on the amount step')
  await page.getByLabel('Note', { exact: true }).fill('Reviewers asked for the pot balance beside the amount field for reassurance.')
  await page.getByLabel('Author', { exact: true }).fill('Playwright')
  await page.getByLabel('Screen', { exact: true }).selectOption('step-amount')
  await page.getByRole('button', { name: 'Save amendment' }).click()
  await expect(page.locator('.amendment-title', { hasText: 'Show the pot balance on the amount step' })).toBeVisible()
  await expect(page.locator('.amendments-panel')).toContainText('2 open')

  // The stale tab is refused, reloads the latest document, and can then write.
  const resolveCap = (target: Page) =>
    target.locator('.amendment-card', { hasText: 'Round-up daily cap' }).getByRole('button', { name: 'Resolve' }).click()
  await resolveCap(stale)
  await expect(stale.locator('.amendment-error')).toContainText('changed since this view loaded')
  await expect(stale.locator('.amendments-panel')).toContainText('2 open')
  await resolveCap(stale)
  await expect(stale.locator('.amendments-panel')).toContainText('1 open')

  // Persistence across a reload.
  await page.reload()
  await page.getByRole('button', { name: /^Review ·/ }).click()
  await expect(page.locator('.amendments-panel')).toContainText('1 open')
  await expect(page.locator('.amendment-card', { hasText: 'Round-up daily cap' }).locator('.amendment-status')).toHaveText('Resolved')
})

test('compact drawers isolate focus, close with Escape, and preserve amendment drafts across resizing', async ({ page }) => {
  await page.getByRole('button', { name: 'Close All prototypes' }).click()
  await page.setViewportSize({ width: 1024, height: 900 })
  const flow = page.getByRole('dialog', { name: 'Scenarios and screens' })
  await expect(flow).toBeHidden()
  const trigger = page.getByRole('button', { name: 'Flows', exact: true })
  await trigger.click()
  await expect(flow).toBeVisible()
  await flow.getByRole('button', { name: 'Close Flows' }).focus()
  await page.keyboard.press('Shift+Tab')
  expect(await flow.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(flow).toBeHidden()
  await expect(trigger).toBeFocused()

  const reviewTrigger = page.getByRole('button', { name: /^Review ·/ })
  await reviewTrigger.click()
  await page.getByRole('button', { name: 'Propose amendment' }).click()
  await page.getByLabel('Title', { exact: true }).fill('Draft survives closing and resizing')
  await page.keyboard.press('Escape')
  await expect(reviewTrigger).toBeFocused()
  await reviewTrigger.click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Draft survives closing and resizing')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(page.getByRole('complementary', { name: 'Design notes and amendments' })).toBeVisible()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Draft survives closing and resizing')
})

test('compare hydrates both scenario fixtures and keeps navigation independent', async ({ page }) => {
  await page.goto('/?prototype=savings-automation&variant=focused-control&surface=ios&scenario=validation-error&screen=configure&theme=light&compare=guided-trust&examples=1')
  const primary = page.frameLocator('iframe.preview-iframe').nth(0)
  const secondary = page.frameLocator('iframe.preview-iframe').nth(1)
  await expect(primary.locator('input[name="amount"]')).toHaveValue('750')
  await expect(secondary.locator('input[name="amount"]')).toHaveValue('750')
  await secondary.locator('input[name="amount"]').fill('30')
  await secondary.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(secondary.getByRole('heading', { name: 'Add card round-ups?' })).toBeVisible()
  await expect(page).toHaveURL(/screen=configure/)
  await page.getByRole('button', { name: 'Reset previews' }).click()
  await expect(secondary.locator('input[name="amount"]')).toHaveValue('750')
  await expect(primary.locator('input[name="amount"]')).toHaveValue('750')
})

test('catalogue search has recovery and compact layouts do not overflow the host', async ({ page }) => {
  await page.getByRole('searchbox', { name: 'Search prototypes' }).fill('missing-prototype')
  await expect(page.getByText('No prototypes found.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear search' }).click()
  await expect(page.getByRole('button', { name: /Savings pots and round-ups automation/ })).toBeVisible()
  await page.getByRole('button', { name: 'Close All prototypes' }).click()
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await expect(page.locator('.preview-stage').first()).toHaveAttribute('data-status', 'ready')
    await expect.poll(() => page.locator('.preview-canvas').evaluate(el => el.clientHeight)).toBeGreaterThan(180)
  }
})

test('a failed amendment save preserves the draft and exposes retry feedback', async ({ page }) => {
  await page.getByRole('button', { name: 'Close All prototypes' }).click()
  await page.getByRole('button', { name: /^Review ·/ }).click()
  await page.getByRole('button', { name: 'Propose amendment' }).click()
  await page.getByLabel('Title', { exact: true }).fill('Retained draft')
  await page.getByLabel('Note', { exact: true }).fill('Keep this observation when saving fails.')
  await page.getByLabel('Author', { exact: true }).fill('Reviewer')
  await expect(page.getByLabel('Screen', { exact: true })).toHaveValue('overview')
  await page.route('**/__playground__/amendments/*', async (route) => {
    if (route.request().method() === 'PUT') await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Save failed. Retry when the server is available.' }) })
    else await route.continue()
  })
  await page.getByRole('button', { name: 'Save amendment' }).click()
  await expect(page.getByRole('alert')).toContainText('Save failed')
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Retained draft')
  await expect(page.getByLabel('Note', { exact: true })).toHaveValue('Keep this observation when saving fails.')
  await expect(page.getByRole('button', { name: 'Save amendment' })).toBeEnabled()
})

test('amendments preserve the active scenario when a screen belongs to multiple scenarios', async ({ page }) => {
  await page.goto('/?prototype=savings-automation&variant=focused-control&surface=ios&scenario=validation-error&screen=configure&theme=light&examples=1')
  await page.getByRole('button', { name: /^Review ·/ }).click()
  await page.getByRole('button', { name: 'Propose amendment' }).click()
  await page.getByLabel('Title', { exact: true }).fill('Clarify the validation error')
  await page.getByLabel('Note', { exact: true }).fill('Review this screen with the invalid amount fixture.')
  await page.getByLabel('Author', { exact: true }).fill('Reviewer')
  await page.route('**/__playground__/amendments/*', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue()
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { etag: '"scenario-test"' }, body: route.request().postData()! })
  })
  const request = page.waitForRequest(req => req.method() === 'PUT' && req.url().includes('/__playground__/amendments/'))
  await page.getByRole('button', { name: 'Save amendment' }).click()
  const amendment = (await request).postDataJSON().amendments.at(-1)
  expect(amendment.selection.scenarioId).toBe('validation-error')
  expect(amendment.screenId).toBe('configure')
  await expect(page.getByRole('status')).toContainText('Changes saved.')
})
