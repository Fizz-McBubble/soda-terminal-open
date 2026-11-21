import type { TeamPrimaryOutputKind } from '../gameDataPacks/teamOutputModuleContract'
import type { TeamSystemRankingProfile } from './teamSystemRankingMethod'

// completePacketKey checks the source result's supported status before access.
type SupportedPacket = { fixedEventValue: number }

function completePacketKey(profile: TeamSystemRankingProfile) {
  const output = profile.sameCoreComparison ?? profile.sameCoreOutput
  return output?.result.status === 'supported' &&
    output.outputSystem === profile.system &&
    profile.primaryOutputAgentId &&
    output.input.subjectAgentId === profile.primaryOutputAgentId &&
    output.eventPacketIdentity === profile.primaryEventCapacity?.eventPacketIdentity
    ? JSON.stringify([profile.system, profile.primaryOutputAgentId, output.eventPacketIdentity])
    : null
}

export function compareProfilesForOrder(
  left: TeamSystemRankingProfile,
  right: TeamSystemRankingProfile,
) {
  const leftOutput = left.sameCoreComparison ?? left.sameCoreOutput
  const rightOutput = right.sameCoreComparison ?? right.sameCoreOutput
  // Complete packets form contiguous groups before legacy feature ordering.
  // Otherwise a partial packet can make the sort non-transitive and place a
  // known loser before its dominator. Group placement establishes no new edge.
  const leftKey = completePacketKey(left)
  const rightKey = completePacketKey(right)
  if (leftKey || rightKey) {
    if (!leftKey) return 1
    if (!rightKey) return -1
    if (leftKey !== rightKey) return leftKey < rightKey ? -1 : 1
    const difference =
      (rightOutput!.result as SupportedPacket).fixedEventValue! -
      (leftOutput!.result as SupportedPacket).fixedEventValue!
    if (difference) return difference
  }
  for (let index = 0; index < left.positiveCapacities.length; index += 1) {
    if (
      left.unknownPositiveCapacityIndices?.includes(index) ||
      right.unknownPositiveCapacityIndices?.includes(index)
    )
      continue
    if (
      (index <= 1 || index === 5) &&
      left.primaryOutputAgentId &&
      right.primaryOutputAgentId &&
      left.primaryOutputAgentId !== right.primaryOutputAgentId
    )
      continue
    const difference = right.positiveCapacities[index]! - left.positiveCapacities[index]!
    if (difference) return difference
  }
  for (let index = 0; index < left.executionBurdens.length; index += 1) {
    const difference = left.executionBurdens[index]! - right.executionBurdens[index]!
    if (difference) return difference
  }
  return 0
}

/** Assigns a dense rank through mechanism-only partial dominance. A dominator
 * always appears earlier in the profile order, so profiles with no known
 * dominators share rank one and deliberately remain tied. */
export function assignMechanisticSystemRankOrder(
  rows: readonly { system: TeamPrimaryOutputKind; profile: TeamSystemRankingProfile }[],
  compare: (
    left: (typeof rows)[number],
    right: (typeof rows)[number],
  ) => 'left' | 'right' | 'tie' | 'incomparable',
  options: { sameOwnerOnly?: boolean } = {},
) {
  const ranks = Array<number>(rows.length).fill(0)
  const depths = Array<number>(rows.length).fill(0)
  const systems = [...new Set(rows.map((row) => row.system))]
  for (const requestedSystem of systems) {
    const ordered = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.system === requestedSystem)
      .sort(
        (left, right) =>
          compareProfilesForOrder(left.row.profile, right.row.profile) || left.index - right.index,
      )
    const systemDepths: number[] = []
    // Opt-in is valid only for comparators that reject two different named
    // owners (the production comparator does). Preserve the global sort and
    // dense-depth compression. Unnamed profiles still see every predecessor.
    const predecessorsByOwner = new Map<string, number[]>()
    const unnamedPredecessors: number[] = []
    for (let index = 0; index < ordered.length; index += 1) {
      const current = ordered[index]!
      let depth = 1
      const owner = current.row.profile.primaryOutputAgentId
      const predecessors =
        options.sameOwnerOnly && owner
          ? [...(predecessorsByOwner.get(owner) ?? []), ...unnamedPredecessors]
          : Array.from({ length: index }, (_, i) => i)
      for (const previousIndex of predecessors) {
        const previous = ordered[previousIndex]!
        if (
          systemDepths[previousIndex]! + 1 > depth &&
          compare(previous.row, current.row) === 'left'
        )
          depth = systemDepths[previousIndex]! + 1
      }
      systemDepths.push(depth)
      depths[current.index] = depth
      if (owner) {
        const list = predecessorsByOwner.get(owner) ?? []
        list.push(index)
        predecessorsByOwner.set(owner, list)
      } else unnamedPredecessors.push(index)
    }
    const denseRankByDepth = new Map(
      [...new Set(systemDepths)]
        .sort((left, right) => left - right)
        .map((depth, index) => [depth, index + 1] as const),
    )
    for (let index = 0; index < ordered.length; index += 1) {
      ranks[ordered[index]!.index] = denseRankByDepth.get(systemDepths[index]!)!
    }
  }
  return { ranks, depths }
}
