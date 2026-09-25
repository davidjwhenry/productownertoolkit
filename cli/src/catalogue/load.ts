import fs from 'node:fs'
import path from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020.js'
import type { Catalogue } from './types.ts'

export const CATALOGUE_PATH = 'toolkit/catalogue.json'
export const CATALOGUE_SCHEMA_PATH = 'toolkit/catalogue.schema.json'
export const SKILLS_PATH = 'toolkit/skills'

export interface LoadResult {
  catalogue?: Catalogue
  errors: string[]
}

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((v, i) => values.indexOf(v) !== i))]
}

/** Load `toolkit/catalogue.json`, validate it against its schema, and check it against the repository. */
export function loadCatalogue(repoRoot: string): LoadResult {
  const read = (p: string) => JSON.parse(fs.readFileSync(path.join(repoRoot, p), 'utf8'))
  const data = read(CATALOGUE_PATH)
  const validate = new Ajv2020({ allErrors: true }).compile(read(CATALOGUE_SCHEMA_PATH))
  if (!validate(data)) {
    return { errors: (validate.errors ?? []).map((e) => `${CATALOGUE_PATH}${e.instancePath} ${e.message}`) }
  }
  const catalogue = data as Catalogue
  const errors: string[] = []

  const skillNames = catalogue.skills.map((s) => s.name)
  for (const name of duplicates(skillNames)) errors.push(`skill "${name}" is declared more than once`)
  for (const id of duplicates(catalogue.capabilities.map((c) => c.id))) errors.push(`capability "${id}" is declared more than once`)
  for (const id of duplicates(catalogue.agents.map((a) => a.id))) errors.push(`agent "${id}" is declared more than once`)

  const skillDirectories = fs
    .readdirSync(path.join(repoRoot, SKILLS_PATH), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
  for (const dir of skillDirectories) {
    if (!skillNames.includes(dir)) errors.push(`${SKILLS_PATH}/${dir} is not declared in the catalogue`)
  }
  for (const name of skillNames) {
    if (!fs.existsSync(path.join(repoRoot, SKILLS_PATH, name, 'SKILL.md'))) {
      errors.push(`skill "${name}" has no ${SKILLS_PATH}/${name}/SKILL.md`)
    }
    const owners = catalogue.capabilities.filter((c) => c.skills.includes(name))
    if (owners.length !== 1) errors.push(`skill "${name}" must belong to exactly one capability, found ${owners.length}`)
  }
  for (const capability of catalogue.capabilities) {
    for (const skill of capability.skills) {
      if (!skillNames.includes(skill)) errors.push(`capability "${capability.id}" lists undeclared skill "${skill}"`)
    }
    const sources = [...capability.managed, ...capability.seed, ...(capability.runtime ? [capability.runtime] : [])]
    for (const { source } of sources) {
      const stat = fs.lstatSync(path.join(repoRoot, source), { throwIfNoEntry: false })
      if (!stat) errors.push(`capability "${capability.id}" source ${source} does not exist`)
      else if (stat.isSymbolicLink()) errors.push(`capability "${capability.id}" source ${source} is a symlink`)
    }
  }
  for (const agent of catalogue.agents) {
    if (!agent.reads.includes(agent.preferredDirectory)) {
      errors.push(`agent "${agent.id}" preferredDirectory ${agent.preferredDirectory} is not in its reads list`)
    }
  }
  if (catalogue.capabilities.filter((c) => c.required).length !== 1) {
    errors.push('exactly one capability must be required')
  }

  return errors.length ? { errors } : { catalogue, errors }
}
