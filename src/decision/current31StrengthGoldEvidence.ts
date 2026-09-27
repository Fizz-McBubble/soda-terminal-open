import type { CurrentMetaStrengthBand } from '../teamEngine/contracts'

export type Current31StrengthGoldCase = {
  caseId: string
  split: 'calibration' | 'independent_holdout'
  memberIds: readonly [string, string, string]
  bangbooId: string
  band: CurrentMetaStrengthBand
  confidence: 'high'
  evidenceRefs: readonly {
    publisher: string
    url: string
    role: 'exact_team_and_bangboo' | 'current_observed_reality' | 'mechanic_cross_check'
    locator: string
  }[]
  labelEvidenceRefs?: readonly string[]
  adjudication: string
}

export const icy = (slug: string) => `https://www.icy-veins.com/zenless-zone-zero/${slug}`

export const prydwenShiyu = 'https://www.prydwen.gg/zenless/shiyu-defense'

export const prydwenDeadlyAssault = 'https://www.prydwen.gg/zenless/deadly-assault'

export function guide(
  slug: string,
  locator: string,
): Current31StrengthGoldCase['evidenceRefs'][number] {
  return {
    publisher: 'Icy Veins',
    url: icy(slug),
    role: 'exact_team_and_bangboo',
    locator,
  }
}

export function observed(
  mode: 'shiyu' | 'deadly_assault',
  locator: string,
): Current31StrengthGoldCase['evidenceRefs'][number] {
  return {
    publisher: 'Prydwen',
    url: mode === 'shiyu' ? prydwenShiyu : prydwenDeadlyAssault,
    role: 'current_observed_reality',
    locator,
  }
}

export function mechanic(
  slug: string,
  locator: string,
): Current31StrengthGoldCase['evidenceRefs'][number] {
  return {
    publisher: 'Icy Veins',
    url: icy(slug),
    role: 'mechanic_cross_check',
    locator,
  }
}

export function gold(
  input: Omit<Current31StrengthGoldCase, 'confidence'>,
): Current31StrengthGoldCase {
  return { ...input, confidence: 'high' }
}
