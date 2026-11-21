import { z } from 'zod'
import { stableContentHash } from './stableContentHash'

/** Retained upstream text, reused without collecting a new source or copying its prose. */
export const reviewedAnomalyPartySource32 = Object.freeze({
  repository: 'frzyc/genshin-optimizer',
  commit: '3456cd0f6f5bea10e168074502460dac2fcd6df4',
  license: 'MIT',
  retainedFileSha256: {
    Promeia: '32241EA9A6EA0A81A709D82C737FA9CE86A93BCBA6860703DAB9D4180C46B4A2',
    Sunna: '3C95C73514FD97C7C84B1EB0E3E1D7A32F1BE4135EF88787C8D659D8DE69EACF',
    NangongYu: '191AE529186874799B9CF4EA147926E1A14A51BF7AB93F1334A4B369F4051CF0',
  },
  parameters: {
    guiltyBaseDefenseIgnore: 0.4,
    guiltyM1AdditionalDefenseIgnore: 0.2,
    guiltyDuration: 30,
    catGazeDefenseReductionPerStack: 0.07,
    catGazeStackCap: 3,
    catGazeStackDuration: 40,
    misstepBaseStunBonus: 0.3,
    misstepM2AdditionalStunBonus: 0.3,
  },
  scope: 'declared_target_snapshots_not_rotation_or_same_hit_order',
})
export const reviewedAnomalyPartyStateHash32 = stableContentHash(reviewedAnomalyPartySource32)
const id = z.string().trim().min(1)
const time = z.number().finite().nonnegative()
const refs = z.array(id).min(1)
const common = {
  sourceIdentityHash: z.literal(reviewedAnomalyPartyStateHash32),
  targetId: id,
  sourceRefs: refs,
}
export const reviewedTargetEffectSnapshotSchema32 = z
  .object({ targetId: id, atSeconds: time })
  .strict()
export const reviewedTargetEffectStateSchema32 = z.discriminatedUnion('kind', [
  z
    .object({
      ...common,
      kind: z.literal('promeia_guilty'),
      /** False is a component-off observation, not proof of a whole EX scenario. */
      active: z.boolean().nullable(),
      /** A prior EX hit. Equal timestamps do not establish hit/Abloom ordering. */
      application: z.object({ eventId: id, atSeconds: time }).strict().nullable(),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('sunna_cat_gaze'),
      stacks: z.number().int().min(0).max(3).nullable(),
      /** Each stack has its own forty-second clock; empty is a declared zero. */
      appliedAtSeconds: z.array(time).max(3),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal('nangong_misstep'),
      applied: z.boolean().nullable(),
      appliedAtSeconds: time.nullable(),
      stun: z
        .object({ epoch: id, startedAtSeconds: time, endsAtSeconds: time })
        .strict()
        .nullable(),
    })
    .strict(),
])
export type ReviewedTargetEffectState32 = z.infer<typeof reviewedTargetEffectStateSchema32>
export type ReviewedTargetEffectSnapshot32 = z.infer<typeof reviewedTargetEffectSnapshotSchema32>
