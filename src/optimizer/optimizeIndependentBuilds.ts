import {
  optimizeAccountBuildsCore,
  type AccountOptimizerOptions,
} from './optimizeAccountBuildsCore'
import type { DriveDisc } from '../domain/schemas'
import type { AgentDiscProfile } from '../assault/engine'
import { driveDiscData } from '../data/gameData'
import { scoringDiscRecordIssue } from '../domain/discScoringInput'
export {
  createAccountCandidateGenerationCache,
  accountOptimizerInputHash,
} from './optimizeAccountBuildsCore'
export type {
  AccountOptimizerOptions,
  AccountCandidateGenerationCache,
  AccountBuildResult,
  AccountDiscChoice,
  AccountLoadout,
  UnavailableDiagnosis,
} from './optimizeAccountBuildsCore'

/** Independent personal scope only; unavailable team runtime is never a fallback. */
export function optimizeIndependentBuilds(
  discs: DriveDisc[],
  profiles: AgentDiscProfile[],
  options: AccountOptimizerOptions = {},
) {
  if (profiles.length > 1 || options.teamAssignmentObjective !== undefined)
    throw new Error('单人求解仅支持零或一个代理人，且不能使用队伍目标。')
  // Preserve warehouse records, but do not let contradictory input enter personal scoring.
  const invalidIds = discs
    .filter((disc) => scoringDiscRecordIssue(disc, driveDiscData?.rules) !== null)
    .map((disc) => disc.id)
  if (Object.values(options.fixedDiscByAgent ?? {}).some((id) => invalidIds.includes(id)))
    throw new Error('固定盘并非明确 S 级或不具备可验证的合法强化记录。')
  // Keep the original array/hash for the shared cache; exclusions are a solve view, not a rewrite.
  const qualifiedProfiles = profiles.map((profile) =>
    profile.setPlans?.some((plan) => plan.personalFitBonusEligible === false)
      ? {
          ...profile,
          setPlans: profile.setPlans.map((plan) =>
            plan.personalFitBonusEligible === false ? { ...plan, fitBonusEligible: false } : plan,
          ),
        }
      : profile,
  )
  return optimizeAccountBuildsCore(
    discs,
    qualifiedProfiles,
    invalidIds.length
      ? {
          ...options,
          excludedDiscIds: [...new Set([...(options.excludedDiscIds ?? []), ...invalidIds])],
        }
      : options,
  )
}
