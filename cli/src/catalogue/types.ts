export interface RootDefinition {
  description: string
  installedDefault: string
  standalone: '.'
}

export interface AgentDefinition {
  id: string
  label: string
  reads: string[]
  preferredDirectory: string
  invocation: string
}

export interface SkillDefinition {
  name: string
  category: 'setup' | 'shaping' | 'writing' | 'review' | 'sync' | 'authoring'
}

export interface FileMapping {
  source: string
  install: string
}

export interface MapRow {
  path: string
  purpose: string
}

export interface RuntimeDefinition {
  source: string
  install: string
  include: string[]
  exclude: string[]
  unmanaged: string[]
}

export interface CapabilityDefinition {
  id: string
  label: string
  description: string
  required: boolean
  skills: string[]
  map: MapRow[]
  managed: FileMapping[]
  runtime?: RuntimeDefinition
  seed: FileMapping[]
}

export interface Catalogue {
  schemaVersion: 1
  roots: { content: RootDefinition; toolkit: RootDefinition }
  agents: AgentDefinition[]
  skills: SkillDefinition[]
  capabilities: CapabilityDefinition[]
}

/** Directory values for the `{content}` and `{toolkit}` path tokens; `.` means the repository root. */
export interface RootValues {
  content: string
  toolkit: string
}
