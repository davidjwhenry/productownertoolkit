/**
 * `npm run handoff -- --prototype <id> [--output <directory>] [--force]` —
 * build one offline hand-off and print the written directory.
 */
import { realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildHandoff } from '../src/handoff/build'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function argValue(name: string): string | undefined {
  const flag = `--${name}`
  const index = process.argv.indexOf(flag)
  if (index === -1) return undefined
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) {
    console.error(`Missing value for ${flag}`)
    process.exit(2)
  }
  return value
}

const prototypeId = argValue('prototype')
if (!prototypeId) {
  console.error('Usage: npm run handoff -- --prototype <id> [--output <directory>] [--force]')
  process.exit(2)
}
const output = argValue('output')
const force = process.argv.includes('--force')

const repoRoot = process.env.PROTOTYPE_PLAYGROUND_ROOT
  ? path.resolve(process.env.PROTOTYPE_PLAYGROUND_ROOT)
  : realpathSync(path.resolve(appRoot, '..'))

try {
  const directory = await buildHandoff({ repoRoot, prototypeId, outputDir: output, force })
  console.log(directory)
} catch (error) {
  console.error(`Hand-off failed: ${(error as Error).message}`)
  process.exit(1)
}
