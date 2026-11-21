import { z } from 'zod'
const id = z.string().min(1)
const members = z.tuple([id, id, id])
export const teamGuidePreferencePresentationSchema = z
  .object({
    contract: z.literal('soda-team-guide-preference-presentation/v1'),
    memberKey: z.string(),
    facts: z.array(
      z
        .object({
          claimId: id,
          preferredMemberIds: members,
          alternativeMemberIds: members,
          sourceVersion: id,
          reason: id,
        })
        .strict(),
    ),
    cautions: z.array(
      z
        .object({
          sourceUrl: z.url(),
          evidenceVersion: z.string().nullable(),
          phase: z.string(),
          partition: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((value, context) => {
    const claims = new Set<string>()
    for (const fact of value.facts) {
      if (
        claims.has(fact.claimId) ||
        new Set(fact.preferredMemberIds).size !== 3 ||
        new Set(fact.alternativeMemberIds).size !== 3 ||
        fact.preferredMemberIds.filter((id) => fact.alternativeMemberIds.includes(id)).length !== 2
      )
        context.addIssue({ code: 'custom', message: '搭配说明的具名记录或固定核心不一致。' })
      claims.add(fact.claimId)
    }
  })
export type TeamGuidePreferencePresentation = z.infer<typeof teamGuidePreferencePresentationSchema>
export function readTeamGuidePreferencePresentation(raw: unknown, memberIds: readonly string[]) {
  const parsed = teamGuidePreferencePresentationSchema.safeParse(raw)
  if (!parsed.success || parsed.data.memberKey !== [...memberIds].sort().join('|')) return null
  const key = [...memberIds].sort().join('|')
  if (
    memberIds.length !== 3 ||
    new Set(memberIds).size !== 3 ||
    parsed.data.facts.some(
      (fact) =>
        ![fact.preferredMemberIds, fact.alternativeMemberIds].some(
          (ids) => [...ids].sort().join('|') === key,
        ),
    )
  )
    return null
  return parsed.data
}
