export function hasDevelopmentComparisonConditions(
  agentId: string,
  engineIds: readonly (string | null | undefined)[],
) {
  return (
    agentId === 'agent-ye-shunguang' ||
    engineIds.some((id) => id === 'wengine-14102' || id === 'wengine-14164')
  )
}
