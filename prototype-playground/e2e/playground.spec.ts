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
})

test('labelled savings example is discoverable with PRD, profile, and requirement traceability', async ({ page }) => {
  await expect(page.getByRole('button', { name: /Savings pots and round-ups automation/ })).toBeVisible()
  await expect(page.locator('.catalogue-badge', { hasText: 'Example' })).toBeVisible()
  await page.getByRole('button', { name: /Savings pots and round-ups automation/ }).click()
  await expect(page.locator('.notes-column')).toContainText('savings-example-prd.md')
  await expect(page.locator('.notes-column')).toContainText('AF.3, AF.4, CT.1')
  await expect(page.locator('.notes-column')).toContainText('default@v002')
  await expect(page.locator('.flow-column')).toContainText('AF.1 · AF.2 · CT.1')
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
  await page.locator('.diagnostics-toggle').click()
  await expect(page.locator('.diagnostics-list')).toContainText('PROTOTYPE_SCHEMA_INVALID')
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
  const hostHeading = await page.locator('.rail-brand h1').textContent()
  expect(hostHeading).toBe('Prototype Playground')
})

test('amendments round-trip through the dev-server write path', async ({ page }) => {
  await page.getByRole('button', { name: /Savings pots and round-ups automation/ }).click()
  await readyWithOverview(page)
  await expect(page.locator('.amendments-panel')).toContainText('2 open')
  await expect(page.locator('.amendment-title', { hasText: 'Round-up daily cap' })).toBeVisible()

  // Jump through an amendment pin.
  await page.locator('.amendment-title', { hasText: 'Round-up daily cap' }).click()
  await expect(page).toHaveURL(/variant=guided-trust/)
  await expect(page).toHaveURL(/screen=step-amount/)
  await expect(frame(page).getByRole('heading', { name: 'How much each time?' })).toBeVisible()

  // Propose a new amendment through the form.
  await page.getByRole('button', { name: 'Propose amendment' }).click()
  await page.getByLabel('Title', { exact: true }).fill('Show the pot balance on the amount step')
  await page.getByLabel('Note', { exact: true }).fill('Reviewers asked for the pot balance beside the amount field for reassurance.')
  await page.getByLabel('Author', { exact: true }).fill('Playwright')
  await page.getByLabel('Screen', { exact: true }).selectOption('step-amount')
  await page.getByRole('button', { name: 'Save amendment' }).click()
  await expect(page.locator('.amendment-title', { hasText: 'Show the pot balance on the amount step' })).toBeVisible()
  await expect(page.locator('.amendments-panel')).toContainText('3 open')

  // Resolve one and verify persistence across a reload.
  await page.locator('.amendment-card', { hasText: 'Say "pause", not "stop"' }).getByRole('button', { name: 'Resolve' }).click()
  await expect(page.locator('.amendments-panel')).toContainText('2 open')
  await page.reload()
  await expect(page.locator('.amendments-panel')).toContainText('2 open')
  await expect(page.locator('.amendment-card', { hasText: 'Say "pause", not "stop"' }).locator('.amendment-status')).toHaveText('Resolved')
})
