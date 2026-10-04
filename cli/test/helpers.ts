/** Temporary target directories and a scripted terminal for CLI tests. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Io } from '../src/io.ts'

export interface TempDir {
  root: string
  write(rel: string, contents: string | Buffer): void
  read(rel: string): string
  exists(rel: string): boolean
  mkdir(rel: string): void
  symlink(rel: string, target: string): void
  files(rel?: string): string[]
}

const created: string[] = []

export function tempDir(): TempDir {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'productownertoolkit-test-')))
  created.push(root)
  const abs = (rel: string) => path.join(root, ...rel.split('/'))
  return {
    root,
    write(rel, contents) {
      fs.mkdirSync(path.dirname(abs(rel)), { recursive: true })
      fs.writeFileSync(abs(rel), contents)
    },
    read: (rel) => fs.readFileSync(abs(rel), 'utf8'),
    exists: (rel) => fs.existsSync(abs(rel)),
    mkdir: (rel) => fs.mkdirSync(abs(rel), { recursive: true }),
    symlink(rel, target) {
      fs.mkdirSync(path.dirname(abs(rel)), { recursive: true })
      fs.symlinkSync(target, abs(rel), process.platform === 'win32' ? 'junction' : 'dir')
    },
    files(rel = '') {
      const base = abs(rel)
      if (!fs.existsSync(base)) return []
      return fs
        .readdirSync(base, { recursive: true, withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => path.relative(base, path.join(d.parentPath, d.name)).split(path.sep).join('/'))
        .sort()
    },
  }
}

export function cleanupTempDirs(): void {
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
}

export interface ScriptedIo extends Io {
  stdout: string[]
  stderr: string[]
  questions: string[]
  output(): string
}

/** An Io whose prompts are answered from `answers`, in order. */
export function scriptedIo(cwd: string, answers?: string[]): ScriptedIo {
  const stdout: string[] = []
  const stderr: string[] = []
  const questions: string[] = []
  const queue = [...(answers ?? [])]
  return {
    stdout,
    stderr,
    questions,
    output: () => [...stdout, ...stderr].join('\n'),
    out: (text) => stdout.push(text),
    err: (text) => stderr.push(text),
    interactive: answers !== undefined,
    async ask(question) {
      questions.push(question)
      const answer = queue.shift()
      if (answer === undefined) throw new Error(`Unexpected prompt: ${question}`)
      return answer
    },
    /** Answers are comma-separated ids; '' keeps the initial selection. */
    async select(message, choices, { initial = [] }) {
      const answer = await this.ask(message)
      return answer === '' ? initial : answer.split(',').map((item) => item.trim()).filter(Boolean)
    },
    color: false,
    cwd,
    env: {},
    nodeVersion: '22.12.0',
  }
}
