export type TeamStrengthBand = 'S' | 'A+' | 'A' | 'B'
export type TeamStrengthEvidenceAuthority = 'reviewed_consensus' | 'published_tier'
export type ExactTeamMemberIds = readonly [string, string, string]

export type TeamStrengthFact = {
  claimId: string
  memberIds: ExactTeamMemberIds
  sourceVersion: string
  publisher: string
  sourceUrl: string
  sourceTier: string
  band: TeamStrengthBand
  authority: TeamStrengthEvidenceAuthority
  checkedAt: string
  locator: string
  withdrawn?: boolean
}

export type TeamStrengthExcludedReason =
  | 'withdrawn'
  | 'invalid_source'
  | 'version_mismatch'
  | 'duplicate_claim'
  | 'lower_authority'

export type TeamStrengthExcludedFact = {
  fact: TeamStrengthFact
  reason: TeamStrengthExcludedReason
}

export type TeamStrengthEvidenceResult = {
  status: 'supported' | 'unknown' | 'conflict'
  band: TeamStrengthBand | null
  confidence: 'medium' | 'low' | 'experimental'
  selectedFacts: TeamStrengthFact[]
  excludedFacts: TeamStrengthExcludedFact[]
  reason: string
}

export type TeamStrengthEvidenceIndex = {
  readonly currentVersion: string
  resolve(memberIds: ExactTeamMemberIds): TeamStrengthEvidenceResult
}

export type SelectTeamStrengthEvidenceInput = {
  currentVersion: string
  memberIds: ExactTeamMemberIds
  facts: readonly TeamStrengthFact[]
}

const bands = new Set<TeamStrengthBand>(['S', 'A+', 'A', 'B'])
const authorities = new Set<TeamStrengthEvidenceAuthority>(['reviewed_consensus', 'published_tier'])

function hasExactTeamMembers(memberIds: readonly string[]): memberIds is ExactTeamMemberIds {
  return (
    memberIds.length === 3 &&
    memberIds.every((memberId) => memberId.trim().length > 0) &&
    new Set(memberIds).size === 3
  )
}

function teamKey(memberIds: ExactTeamMemberIds) {
  return [...memberIds].sort((left, right) => left.localeCompare(right)).join('|')
}

function isNonEmpty(value: string) {
  return value.trim().length > 0
}

function isValidSourceUrl(value: string) {
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !!parsed.hostname
  } catch {
    return false
  }
}

function isValidFact(fact: TeamStrengthFact) {
  return (
    hasExactTeamMembers(fact.memberIds) &&
    isNonEmpty(fact.claimId) &&
    isNonEmpty(fact.sourceVersion) &&
    isNonEmpty(fact.publisher) &&
    isValidSourceUrl(fact.sourceUrl) &&
    isNonEmpty(fact.sourceTier) &&
    bands.has(fact.band) &&
    authorities.has(fact.authority) &&
    isNonEmpty(fact.checkedAt) &&
    !Number.isNaN(Date.parse(fact.checkedAt)) &&
    isNonEmpty(fact.locator)
  )
}

function duplicateClaimKey(fact: TeamStrengthFact) {
  return `${fact.publisher.trim().toLocaleLowerCase()}|${fact.claimId.trim()}`
}

function selectIndexedTeamFacts(
  currentVersion: string,
  teamFacts: readonly TeamStrengthFact[],
): TeamStrengthEvidenceResult {
  const excludedFacts: TeamStrengthExcludedFact[] = []
  const eligibleFacts: TeamStrengthFact[] = []

  for (const fact of teamFacts) {
    if (fact.withdrawn) {
      excludedFacts.push({ fact, reason: 'withdrawn' })
    } else if (!isValidFact(fact)) {
      excludedFacts.push({ fact, reason: 'invalid_source' })
    } else if (fact.sourceVersion !== currentVersion) {
      excludedFacts.push({ fact, reason: 'version_mismatch' })
    } else {
      eligibleFacts.push(fact)
    }
  }

  const selectedAuthority: TeamStrengthEvidenceAuthority | null = eligibleFacts.some(
    (fact) => fact.authority === 'reviewed_consensus',
  )
    ? 'reviewed_consensus'
    : eligibleFacts.some((fact) => fact.authority === 'published_tier')
      ? 'published_tier'
      : null

  if (selectedAuthority === null) {
    return {
      status: 'unknown',
      band: null,
      confidence: 'experimental',
      selectedFacts: [],
      excludedFacts,
      reason: 'No valid current-version evidence supports this exact three-member team.',
    }
  }

  const authorityFacts: TeamStrengthFact[] = []
  for (const fact of eligibleFacts) {
    if (fact.authority === selectedAuthority) {
      authorityFacts.push(fact)
    } else {
      excludedFacts.push({ fact, reason: 'lower_authority' })
    }
  }

  const selectedFacts: TeamStrengthFact[] = []
  const claimsByPublisher = new Map<string, Map<TeamStrengthBand, TeamStrengthFact>>()
  for (const fact of authorityFacts) {
    const claimKey = duplicateClaimKey(fact)
    const bandClaims = claimsByPublisher.get(claimKey) ?? new Map()
    if (bandClaims.has(fact.band)) {
      excludedFacts.push({ fact, reason: 'duplicate_claim' })
      continue
    }
    bandClaims.set(fact.band, fact)
    claimsByPublisher.set(claimKey, bandClaims)
    selectedFacts.push(fact)
  }

  const selectedBands = [...new Set(selectedFacts.map((fact) => fact.band))]
  if (selectedBands.length > 1) {
    return {
      status: 'conflict',
      band: null,
      confidence: 'experimental',
      selectedFacts,
      excludedFacts,
      reason: `Equal-authority evidence conflicts across bands: ${selectedBands.join(', ')}.`,
    }
  }

  const band = selectedBands[0]!
  return {
    status: 'supported',
    band,
    confidence: selectedAuthority === 'reviewed_consensus' ? 'medium' : 'low',
    selectedFacts,
    excludedFacts,
    reason:
      selectedAuthority === 'reviewed_consensus'
        ? 'A reviewed consensus supports this exact current-version team.'
        : 'Published tier evidence supports this exact current-version team without calibrated consensus.',
  }
}

export function createTeamStrengthEvidenceIndex(
  facts: readonly TeamStrengthFact[],
  currentVersion: string,
): TeamStrengthEvidenceIndex {
  const factsByTeam = new Map<string, TeamStrengthFact[]>()
  for (const fact of facts) {
    if (!hasExactTeamMembers(fact.memberIds)) continue
    const key = teamKey(fact.memberIds)
    const indexedFacts = factsByTeam.get(key) ?? []
    indexedFacts.push(fact)
    factsByTeam.set(key, indexedFacts)
  }

  return {
    currentVersion,
    resolve(memberIds) {
      if (!hasExactTeamMembers(memberIds)) {
        return {
          status: 'unknown',
          band: null,
          confidence: 'experimental',
          selectedFacts: [],
          excludedFacts: [],
          reason: 'A strength lookup requires three distinct member IDs.',
        }
      }
      return selectIndexedTeamFacts(currentVersion, factsByTeam.get(teamKey(memberIds)) ?? [])
    },
  }
}

export function selectTeamStrengthEvidence({
  currentVersion,
  memberIds,
  facts,
}: SelectTeamStrengthEvidenceInput): TeamStrengthEvidenceResult {
  return createTeamStrengthEvidenceIndex(facts, currentVersion).resolve(memberIds)
}
