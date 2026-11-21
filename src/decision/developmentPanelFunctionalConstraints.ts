import type { ObjectiveEvaluation } from '../calculation/dynamic/objectiveEvidence'
import { stableContentHash } from '../gameDataPacks/types'
import type {
  CandidatePanelObjective,
  CandidatePanelObjectiveTarget,
} from '../optimizer/candidatePanelObjective'

/** Preserve the declared source target dimension when constructing functional guards. */
export function developmentPanelFunctionalConstraints(
  baseline: CandidatePanelObjective | undefined,
  panel: CandidatePanelObjective | undefined,
  target: CandidatePanelObjectiveTarget | null,
): ObjectiveEvaluation['functional'] {
  if (!baseline) return {}
  if (baseline.priorityStat === 'source') {
    if (
      !target ||
      target.priorityStat !== 'source' ||
      !Number.isFinite(target.minimumAttack) ||
      (target.minimumInitialHp !== undefined && !Number.isFinite(target.minimumInitialHp))
    )
      throw new Error('invalid_candidate_panel_target')
    if (target.minimumInitialHp !== undefined)
      return {
        initialHp: {
          actual:
            panel?.priorityStat === 'source' && Number.isFinite(panel.hpDeficit)
              ? -panel.hpDeficit!
              : null,
          minimum: Number.isFinite(baseline.hpDeficit) ? -baseline.hpDeficit! : Number.NaN,
          authorityKey: 'reviewed-initial-hp-target',
        },
      }
    return {
      attack: {
        actual: panel ? -panel.attackDeficit : null,
        minimum: -baseline.attackDeficit,
        authorityKey: stableContentHash('source'),
      },
    }
  }
  return {
    attack: {
      actual: panel ? -panel.attackDeficit : null,
      minimum: -baseline.attackDeficit,
      authorityKey: stableContentHash(baseline.priorityStat ?? 'anomalyProficiency'),
    },
    priority: {
      actual: panel?.[baseline.priorityStat ?? 'anomalyProficiency'] ?? null,
      minimum: baseline[baseline.priorityStat ?? 'anomalyProficiency'] ?? Number.NaN,
      authorityKey: baseline.priorityStat ?? 'anomalyProficiency',
    },
  }
}
