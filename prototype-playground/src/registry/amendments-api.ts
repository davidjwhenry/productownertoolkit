/**
 * Dev-server amendments API: the playground's first write path. Serves
 * `GET`/`PUT /__playground__/amendments/:prototypeId` against the
 * prototype directory's `amendments.json`. Every write is schema-checked
 * and cross-checked against the live catalogue (screen ids, requirement
 * ids, selection references) before an atomic temp-file-plus-rename
 * replaces the previous document. Writes are optimistic: `GET` returns an
 * `ETag` revision, and `PUT` must echo it in `If-Match` or receive `409`
 * when another tab has changed the document since. The static hand-off
 * build has no server, so the shell treats amendments as read-only there.
 */
import { createHash, randomBytes } from 'node:crypto'
import { rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { AmendmentsManifest, CatalogueResult, PrototypeRecord } from '../contracts'
import { MAX_JSON_BYTES } from '../validation/limits'
import { PathError, PathResolver } from '../validation/paths'
import { validateManifest } from '../validation/schemas'

const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type AmendmentsApiRequest = {
  method: string
  /** Remaining path after the mount point: `/<prototypeId>`. */
  suffix: string
  /** Raw request body for writes; empty for reads. */
  body: Buffer
  /** `If-Match` revision for writes, as returned in a previous `ETag`. */
  ifMatch?: string
  repoRoot: string
  /** Loads (or reuses) the repository catalogue. */
  loadCatalogue: () => Promise<CatalogueResult>
}

export type AmendmentsApiResponse = {
  status: number
  /** Serialised JSON response body. */
  body: string
  /** Revision of the document now on disk, sent as `ETag`. */
  etag?: string
}

/** Pending writes per amendments file, so revision checks and renames never interleave. */
const writeQueues = new Map<string, Promise<unknown>>()

function serialise<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(key) ?? Promise.resolve()
  const run = previous.then(task, task)
  const settled = run.catch(() => undefined)
  writeQueues.set(key, settled)
  void settled.then(() => {
    if (writeQueues.get(key) === settled) writeQueues.delete(key)
  })
  return run
}

/** Quoted strong ETag for the on-disk bytes; a missing file has its own fixed revision. */
export function amendmentsRevision(bytes: Buffer | null): string {
  return bytes ? `"${createHash('sha256').update(bytes).digest('hex')}"` : '"empty"'
}

function json(status: number, value: unknown): AmendmentsApiResponse {
  return { status, body: `${JSON.stringify(value)}\n` }
}

function themeIds(record: PrototypeRecord, catalogue: CatalogueResult): Set<string> {
  const profile = catalogue.profiles[`${record.designSystem.id}@${record.designSystem.version}`]
  return new Set((profile?.themes ?? []).map((theme) => theme.id))
}

/** Validate one document against the record; returns the first problem or null. */
export function checkAmendmentsDocument(
  doc: AmendmentsManifest,
  record: PrototypeRecord,
  catalogue: CatalogueResult,
): string | null {
  const schemaError = validateManifest('amendments', doc)
  if (schemaError) return schemaError
  const requirementIds = new Set([
    ...record.source.requirementIds,
    ...record.scenarios.flatMap((scenario) => scenario.requirementIds),
  ])
  // Screen ids repeat across scenarios, so index each variant by `scenarioId/screenId`.
  const screensByVariant = new Map<string, Set<string>>()
  for (const variant of record.variants) {
    screensByVariant.set(
      variant.id,
      new Set((variant.screens ?? []).map((screen) => `${screen.scenarioId}/${screen.id}`)),
    )
  }
  const variants = new Set(record.variants.map((variant) => variant.id))
  const scenarios = new Set(record.scenarios.map((scenario) => scenario.id))
  const surfaces = new Set(record.surfaces)
  const themes = themeIds(record, catalogue)
  const seen = new Set<string>()
  for (const amendment of doc.amendments) {
    if (seen.has(amendment.id)) return `Amendment id "${amendment.id}" is used more than once`
    seen.add(amendment.id)
    const variantScreens = screensByVariant.get(amendment.selection.variantId)
    const scenarioId = amendment.selection.scenarioId
    if (!variantScreens?.has(`${scenarioId}/${amendment.screenId}`)) {
      return `Amendment "${amendment.id}": screen "${amendment.screenId}" is not declared by variant "${amendment.selection.variantId}" for scenario "${scenarioId}"`
    }
    if (amendment.requirementId !== null && !requirementIds.has(amendment.requirementId)) {
      return `Amendment "${amendment.id}": requirement "${amendment.requirementId}" is not declared`
    }
    const selection = amendment.selection
    if (!variants.has(selection.variantId)) return `Amendment "${amendment.id}": unknown variant "${selection.variantId}"`
    if (!scenarios.has(selection.scenarioId)) return `Amendment "${amendment.id}": unknown scenario "${selection.scenarioId}"`
    if (!surfaces.has(selection.surfaceId)) return `Amendment "${amendment.id}": unknown surface "${selection.surfaceId}"`
    if (!themes.has(selection.themeId)) return `Amendment "${amendment.id}": unknown theme "${selection.themeId}"`
    if (!variantScreens?.has(`${scenarioId}/${selection.screenId}`)) {
      return `Amendment "${amendment.id}": selection screen "${selection.screenId}" is not declared by variant "${selection.variantId}" for scenario "${scenarioId}"`
    }
  }
  return null
}

/** Handle one `/__playground__/amendments/...` request. Never throws. */
export async function handleAmendmentsRequest(request: AmendmentsApiRequest): Promise<AmendmentsApiResponse> {
  const prototypeId = request.suffix.replace(/^\//, '').split('/')[0] ?? ''
  if (!KEBAB_ID.test(prototypeId)) return json(404, { error: 'unknown prototype' })

  let catalogue: CatalogueResult
  try {
    catalogue = await request.loadCatalogue()
  } catch {
    return json(503, { error: 'catalogue unavailable' })
  }
  const record = catalogue.records.find((candidate) => candidate.id === prototypeId)
  if (!record) return json(404, { error: 'unknown prototype' })

  const resolver = new PathResolver(request.repoRoot)
  const prototypeDir = path.dirname(record.manifestPath)
  const amendmentsPath = `${prototypeDir}/amendments.json`
  const readCurrent = async (): Promise<Buffer | null> => {
    try {
      const file = await resolver.resolveFile({ kind: 'prototype-amendments', prototypeDir }, amendmentsPath, MAX_JSON_BYTES)
      return file.bytes
    } catch (error) {
      if (error instanceof PathError && error.code === 'SOURCE_NOT_FOUND') return null
      throw error
    }
  }

  if (request.method === 'GET') {
    let bytes: Buffer | null
    try {
      bytes = await readCurrent()
    } catch {
      return json(500, { error: 'read failed' })
    }
    const etag = amendmentsRevision(bytes)
    if (!bytes) return { ...json(200, { schemaVersion: 1, amendments: [] }), etag }
    return { status: 200, body: bytes.toString('utf8'), etag }
  }

  if (request.method === 'PUT') {
    if (request.body.length === 0) return json(400, { error: 'empty body' })
    if (request.body.length > MAX_JSON_BYTES) return json(413, { error: 'body too large' })
    let parsed: unknown
    try {
      parsed = JSON.parse(request.body.toString('utf8'))
    } catch {
      return json(400, { error: 'invalid JSON' })
    }
    const problem = checkAmendmentsDocument(parsed as AmendmentsManifest, record, catalogue)
    if (problem) return json(422, { error: problem })
    const ifMatch = request.ifMatch
    if (!ifMatch) return json(428, { error: 'missing If-Match revision' })
    const serialised = `${JSON.stringify(parsed as AmendmentsManifest, null, 2)}\n`
    return serialise(amendmentsPath, async () => {
      let current: Buffer | null
      try {
        current = await readCurrent()
      } catch {
        return json(500, { error: 'read failed' })
      }
      const currentRevision = amendmentsRevision(current)
      if (ifMatch !== currentRevision) {
        return { ...json(409, { error: 'Amendments changed since this view loaded; reload to see the latest' }), etag: currentRevision }
      }
      const staging = resolver.join(`${prototypeDir}/.amendments-${randomBytes(6).toString('hex')}.tmp`)
      try {
        await writeFile(staging, serialised, 'utf8')
        await rename(staging, resolver.join(amendmentsPath))
      } catch {
        await rm(staging, { force: true }).catch(() => undefined)
        return json(500, { error: 'write failed' })
      }
      return { status: 200, body: serialised, etag: amendmentsRevision(Buffer.from(serialised, 'utf8')) }
    })
  }

  return json(405, { error: 'method not allowed' })
}
