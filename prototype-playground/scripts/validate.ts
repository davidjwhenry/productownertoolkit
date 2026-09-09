/**
 * `npm run validate` — validate the active design profile, every live
 * manifest, and every example manifest; print the profile/version, valid
 * prototype count, warning count, and error count; exit non-zero on
 * errors. `--strict` additionally requires an active profile (used by
 * `npm run build`).
 */
import { realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRepositoryCatalogue } from '../src/registry/catalogue'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function resolveRepoRoot(): string {
  const override = process.env.PROTOTYPE_PLAYGROUND_ROOT
  if (override) return path.resolve(override)
  return realpathSync(path.resolve(appRoot, '..'))
}

const strict = process.argv.includes('--strict')

const catalogue = await loadRepositoryCatalogue(resolveRepoRoot(), { includeExamples: true })

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
