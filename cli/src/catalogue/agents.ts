import type { Catalogue } from './types.ts'

/**
 * The fewest skill folders that give every selected agent the skills. Agents that read a single
 * folder claim it first; an agent that reads several (Cursor) reuses a folder already chosen,
 * or falls back to its preferred folder. Folders already installed are kept, so adding an agent
 * never moves existing skills.
 */
export function skillDirectoriesFor(catalogue: Catalogue, agentIds: string[], existing: string[] = []): string[] {
  const agents = catalogue.agents
    .filter((a) => agentIds.includes(a.id))
    .sort((a, b) => a.reads.length - b.reads.length)
  const directories: string[] = [...existing]
  for (const agent of agents) {
    if (!agent.reads.some((dir) => directories.includes(dir))) directories.push(agent.preferredDirectory)
  }
  return directories
}

/** Every folder any supported agent reads skills from. */
export function allSkillDirectories(catalogue: Catalogue): string[] {
  return [...new Set(catalogue.agents.flatMap((a) => a.reads))]
}
