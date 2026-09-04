/**
 * JSON Schema 2020-12 validators for the repository manifests. Schemas in
 * `prototype-playground/schemas/` are the source of truth; this loader
 * compiles them once per process. Node-only: the browser receives the
 * already-validated catalogue through `virtual:prototype-registry` and
 * never re-validates manifests.
 */
import type { ErrorObject } from 'ajv'
import type { ValidateFunction } from 'ajv/dist/2020'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type SchemaName = 'design-profile' | 'components' | 'assets' | 'prototype'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const validators = new Map<SchemaName, ValidateFunction>()

export function getValidator(schema: SchemaName): ValidateFunction {
  const cached = validators.get(schema)
  if (cached) return cached
  const ajv = new Ajv2020({ strict: true, allErrors: true })
  addFormats(ajv)
  const schemaPath = path.join(appRoot, 'schemas', `${schema}.schema.json`)
  const compiled = ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')))
  validators.set(schema, compiled)
  return compiled
}

/** Human-readable, field-addressed summary of Ajv errors. */
export function formatSchemaErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors) return 'schema validation failed'
  return errors
    .map((error) => {
      const field = error.instancePath === '' ? 'document root' : error.instancePath
      return `${field} ${error.message ?? 'is invalid'}`
    })
    .join('; ')
}

/** Validate a parsed manifest, returning an error message or `null`. */
export function validateManifest(schema: SchemaName, value: unknown): string | null {
  const validate = getValidator(schema)
  if (validate(value)) return null
  return formatSchemaErrors(validate.errors)
}
