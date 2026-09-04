/**
 * Deterministic e2e fixture repository under `.e2e-tmp/fixture-repo`,
 * created before the Playwright web server starts. The fixture mirrors
 * the checked-in design system and examples so failure cases never write
 * under `requirements/` or `examples/`; tests mutate only this tree.
 */
import { cp, mkdir, rm } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = realpathSync(path.resolve(appRoot, '..'))
const fixtureRoot = path.join(appRoot, '.e2e-tmp', 'fixture-repo')

await rm(path.join(appRoot, '.e2e-tmp'), { recursive: true, force: true })
await mkdir(fixtureRoot, { recursive: true })
await cp(path.join(repoRoot, 'design-system'), path.join(fixtureRoot, 'design-system'), { recursive: true })
await cp(path.join(repoRoot, 'examples'), path.join(fixtureRoot, 'examples'), { recursive: true })
await mkdir(path.join(fixtureRoot, 'requirements', 'platform-requirements'), { recursive: true })
await mkdir(path.join(fixtureRoot, 'requirements', 'customer-functional-requirements'), { recursive: true })
await mkdir(path.join(fixtureRoot, 'requirements', 'internal-functional-requirements'), { recursive: true })

console.log(fixtureRoot)
