import type { Amendment, PrototypeRecord } from '../contracts'
import { selectionToQuery } from './useSelectionState'

type BriefRecord = Pick<PrototypeRecord, 'id' | 'title' | 'manifestPath' | 'source' | 'designSystem' | 'origin'>

/** A portable hand-off containing the feedback itself, not just a review URL. */
export function buildAmendmentsBrief(record: BriefRecord, amendments: readonly Amendment[], baseUrl: string): string {
  const open = amendments.filter((amendment) => amendment.status === 'open')
  const feedback = open.map((amendment, index) => {
    const query = selectionToQuery({
      prototypeId: record.id,
      ...amendment.selection,
      screenId: amendment.screenId,
      compareVariantId: null,
      showExamples: record.origin === 'example',
    })
    return `${index + 1}. ${amendment.title} (${amendment.id})
   Screen: \`${amendment.screenId}\`; variant: \`${amendment.selection.variantId}\`; scenario: \`${amendment.selection.scenarioId}\`; surface: \`${amendment.selection.surfaceId}\`; theme: \`${amendment.selection.themeId}\`.
   Requirement: ${amendment.requirementId ? `\`${amendment.requirementId}\`` : 'Not specified'}.
   Reviewer: ${amendment.author}, ${amendment.date}.
   Review link: ${new URL(query, baseUrl).href}

${amendment.note.split('\n').map((line) => `> ${line}`).join('\n')}`
  }).join('\n\n')

  return `Review and address ${open.length} open amendment${open.length === 1 ? '' : 's'} for prototype "${record.title}" (\`${record.id}\`).

Manifest: \`${record.manifestPath}\`
Amendments: \`${record.manifestPath.replace(/[^/]+$/, 'amendments.json')}\`
Source PRD: \`${record.source.prd}\`
Pinned design profile: \`${record.designSystem.id}@${record.designSystem.version}\` (${record.designSystem.fingerprint}).

Read the PRD and pinned profile, then inspect each referenced screen. Apply prototype-only fixes; propose any PRD or backlog changes for approval. Preserve unrelated variants and scenarios. Verify the affected flows in the playground and run validation from prototype-playground. Report the changes and verification; leave amendment statuses unchanged until the review is approved.

Reviewer feedback:

${feedback || 'No open amendments.'}`
}
