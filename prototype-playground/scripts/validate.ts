/**
 * `npm run validate` — validate the active design profile, every live
 * manifest, and every example manifest; print the profile/version, valid
 * prototype count, warning count, and error count; exit non-zero on
 * errors. `--strict` additionally requires an active profile (used by
 * `npm run build`).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRepositoryCatalogue } from '../src/registry/catalogue'
import { describeWorkspace, resolveWorkspace, type Workspace } from '../src/workspace'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const strict = process.argv.includes('--strict')

let workspace: Workspace
try {
  workspace = resolveWorkspace(appRoot)
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
console.log(describeWorkspace(workspace))

const catalogue = await loadRepositoryCatalogue(workspace.contentRoot, { includeExamples: true })

const profile = catalogue.activeProfile
if (profile) {
  console.log(`Active design profile: ${profile.id}@${profile.version} (${profile.fingerprint})`)
} else {
  console.log('Active design profile: none (design-system/profiles/ACTIVE is missing or invalid)')
}
console.log(`Valid prototypes: ${catalogue.records.length}`)
console.log(`Warnings: ${catalogue.totals.warnings}`)
console.log(`Errors: ${catalogue.totals.errors}`)

for (const diagnostic of catalogue.diagnostics) {
  const label = diagnostic.severity === 'error' ? 'ERROR' : 'WARN'
  console.log(`${label} [${diagnostic.code}] ${diagnostic.path}: ${diagnostic.message}`)
}
if (catalogue.totals.errors > 0 && catalogue.diagnostics.length < catalogue.totals.warnings + catalogue.totals.errors) {
  console.log(`(Diagnostics surfaced: ${catalogue.diagnostics.length}; totals include uncapped counts.)`)
}

const failed = catalogue.totals.errors > 0 || (strict && !catalogue.activeProfile)
if (failed) {
  process.exit(1)
}
