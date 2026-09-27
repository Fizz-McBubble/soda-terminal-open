import { z } from 'zod'

/**
 * Minimal, data-only compatibility record for Amillion.  No Hakushin raw
 * file, Nx runtime, or generated database is included in Soda Terminal.
 *
 * HakushinData is deliberately marked license-unknown.  These individually
 * reviewed constants retain their source identity and are not promoted to
 * player-account facts or Planning authority on their own.
 */
export const amillionCompatibilitySource = Object.freeze({
  genshinOptimizerCommit: '180a0a1015cb725c7570cd828eb086749960df98',
  hakushinCommit: '27140bb6f5df4cd06432a8f40df8600b832f26c6',
  rawPath: 'bangboo/54005.json',
  rawSha256: '6ABA70EDA6AB0EA46315BA38A393D931A3E2CDEA6378C76626696E33EE6C972D',
  rawLicense: 'unknown' as const,
  scaling: 'DamagePercentage/Main and Growth are fractions divided by 10000' as const,
})

/**
 * Reviewed stat relation: floor(base + (level - 1) * upgrade / 10000 +
 * currentAscension.attack).  This is a tiny normalized fact, not a copy of
 * Hakushin's raw asset. The value is cross-checked against the public BWIKI
 * breakpoint table; the latter is citation-only (CC BY-NC-SA).
 */
export const amillionAttackCurve = Object.freeze({
  baseAttack: 72,
  attackUpgrade: 360408,
  ascensionAttackByLevelCap: { 10: 0, 20: 67, 30: 333, 40: 1000, 50: 2666, 60: 6665 },
})

const skillKindSchema = z.enum(['active', 'chain'])
const skillLevelSchema = z.number().int().min(1).max(10)
const enemyCountSchema = z.number().int().min(1).max(3)

/** These are the two reviewed SkillProp rows, not a vendored raw data file. */
const rawSkillProps = Object.freeze({
  active: { main: 81000, growth: 8100, cooldownSeconds: 22 },
  chain: { main: 84000, growth: 8400, dazeMain: 12000, dazeGrowth: 1200 },
})

const chainBonusByStarsAndEnemyCount = Object.freeze({
  1: [4500, 3500, 2500],
  2: [5600, 4300, 3100],
  3: [6700, 5100, 3700],
  4: [7800, 6000, 4300],
  5: [9000, 7000, 5000],
} as const)

export function resolveAmillionDamageMultiplier(input: unknown) {
  const parsed = z.object({ kind: skillKindSchema, skillLevel: skillLevelSchema }).safeParse(input)
  if (!parsed.success)
    return {
      status: 'unsupported' as const,
      blockers: ['艾米莉安技能等级必须是 1-10 的具名输入。'],
    }
  const prop = rawSkillProps[parsed.data.kind]
  return {
    status: 'supported' as const,
    kind: parsed.data.kind,
    skillLevel: parsed.data.skillLevel,
    multiplier: (prop.main + prop.growth * (parsed.data.skillLevel - 1)) / 10000,
    cooldownSeconds: parsed.data.kind === 'active' ? rawSkillProps.active.cooldownSeconds : null,
  }
}

export function resolveAmillionChainBonus(input: unknown) {
  const parsed = z
    .object({
      stars: z.number().int().min(1).max(5),
      enemyCount: enemyCountSchema,
      cunningHaresMemberCount: z.number().int().min(0).max(3),
    })
    .safeParse(input)
  if (!parsed.success)
    return {
      status: 'unsupported' as const,
      blockers: ['艾米莉安星级、敌人数和狡兔屋成员数必须具名。'],
    }
  if (parsed.data.cunningHaresMemberCount < 2)
    return {
      status: 'supported' as const,
      active: false,
      damageBonus: 0,
      reason: '艾米莉安额外能力未满足双狡兔屋条件。',
    }
  return {
    status: 'supported' as const,
    active: true,
    damageBonus:
      chainBonusByStarsAndEnemyCount[parsed.data.stars as 1 | 2 | 3 | 4 | 5][
        parsed.data.enemyCount - 1
      ] / 10000,
    reason: '艾米莉安额外能力已满足双狡兔屋条件。',
  }
}

/**
 * This is intentionally a compatibility readiness check, not a damage
 * calculator. Planning still requires explicit skill levels and a frozen
 * active/chain occurrence count; neither is inferred from the roster.
 */
export function inspectAmillionPlanningInputs(input: unknown) {
  const parsed = z
    .object({
      level: z.number().int().min(1).max(60).nullable(),
      ascensionLevelCap: z
        .union([
          z.literal(10),
          z.literal(20),
          z.literal(30),
          z.literal(40),
          z.literal(50),
          z.literal(60),
        ])
        .nullable(),
      stars: z.number().int().min(1).max(5).nullable(),
      activeSkillLevel: skillLevelSchema.nullable(),
      chainSkillLevel: skillLevelSchema.nullable(),
      attack: z
        .object({ value: z.number().positive(), evidenceRefs: z.array(z.string().min(1)).min(1) })
        .nullable()
        .optional(),
      activeUseCount: z.number().int().nonnegative().nullable(),
      chainUseCount: z.number().int().nonnegative().nullable(),
      enemyCount: enemyCountSchema.nullable(),
      cunningHaresMemberCount: z.number().int().min(0).max(3).nullable(),
    })
    .safeParse(input)
  if (!parsed.success)
    return { status: 'unsupported' as const, blockers: ['艾米莉安 Planning 输入结构无效。'] }
  const value = parsed.data
  const blockers: string[] = []
  if (value.level === null || value.ascensionLevelCap === null)
    blockers.push('账户/权威输入未提供艾米莉安等级和当前突破档。')
  if (value.stars === null) blockers.push('账户未提供艾米莉安星级。')
  if (value.activeSkillLevel === null || value.chainSkillLevel === null)
    blockers.push('账户/权威输入未提供艾米莉安主动与连携技能等级。')
  const projectedAttack =
    value.level === null || value.ascensionLevelCap === null
      ? null
      : projectAmillionAttack({
          level: value.level,
          ascensionLevelCap: value.ascensionLevelCap,
        })
  if (value.attack == null && (!projectedAttack || projectedAttack.status !== 'supported'))
    blockers.push('权威输入未提供按艾米莉安等级/突破曲线投影的最终攻击力及其证据。')
  if (value.activeUseCount === null || value.chainUseCount === null)
    blockers.push('PlanningBaseline 未冻结艾米莉安主动和连携在声明时长内的次数。')
  if (value.enemyCount === null)
    blockers.push('PlanningBaseline 未冻结艾米莉安额外能力所用敌人数。')
  if (value.cunningHaresMemberCount === null)
    blockers.push('Team Event Bundle 未声明艾米莉安双狡兔屋适用条件。')
  return blockers.length
    ? { status: 'unsupported' as const, blockers }
    : {
        status: 'ready_for_damage' as const,
        active: resolveAmillionDamageMultiplier({
          kind: 'active',
          skillLevel: value.activeSkillLevel,
        }),
        chain: resolveAmillionDamageMultiplier({
          kind: 'chain',
          skillLevel: value.chainSkillLevel,
        }),
        chainBonus: resolveAmillionChainBonus({
          stars: value.stars,
          enemyCount: value.enemyCount,
          cunningHaresMemberCount: value.cunningHaresMemberCount,
        }),
        attack: value.attack ?? {
          value: projectedAttack!.attack,
          evidenceRefs: ['Hakushin:bangboo/54005.json'],
        },
      }
}

export function projectAmillionAttack(input: unknown) {
  const parsed = z
    .object({
      level: z.number().int().min(1).max(60),
      ascensionLevelCap: z.union([
        z.literal(10),
        z.literal(20),
        z.literal(30),
        z.literal(40),
        z.literal(50),
        z.literal(60),
      ]),
    })
    .safeParse(input)
  if (!parsed.success)
    return { status: 'unsupported' as const, blockers: ['艾米莉安等级和当前突破档必须具名。'] }
  if (parsed.data.level > parsed.data.ascensionLevelCap)
    return {
      status: 'unsupported' as const,
      blockers: ['艾米莉安等级不能超过当前突破档等级上限。'],
    }
  return {
    status: 'supported' as const,
    attack: Math.floor(
      amillionAttackCurve.baseAttack +
        (parsed.data.level - 1) * (amillionAttackCurve.attackUpgrade / 10000) +
        amillionAttackCurve.ascensionAttackByLevelCap[parsed.data.ascensionLevelCap],
    ),
  }
}
