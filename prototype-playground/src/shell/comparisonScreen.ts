/** Match shared screens, or the first step after the preceding shared screen.
 * This aligns a compact setup with the start of its expanded guided sequence.
 */
export function comparisonScreenId(
  screenId: string,
  primary: readonly { id: string }[],
  comparison: readonly { id: string }[],
): string | null {
  if (comparison.some((screen) => screen.id === screenId)) return screenId
  const index = primary.findIndex((screen) => screen.id === screenId)
  if (index < 0) return null
  for (let previous = index - 1; previous >= 0; previous--) {
    const anchor = comparison.findIndex((screen) => screen.id === primary[previous]!.id)
    if (anchor >= 0) return comparison[Math.min(anchor + 1, comparison.length - 1)]!.id
  }
  return comparison[0]?.id ?? null
}
