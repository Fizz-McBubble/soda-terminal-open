import { playerConditionLines } from '../../application/playerDecisionPresentation'

const claretLevelReference = '60级养成参考；防御力2300–2600+，生命值9500+。'
const claretLevelBoundary = '60级配装参考：防御力2300–2600+；这不是机制满档线或最佳配置。'
const claretCritReference =
  '128.9%暴击率以「猩红渴望」为前提，不能套用于其他音擎；计入核心、音擎和队友加成后，局内暴击率尽量接近200%。'
const claretCombatCondition =
  /^战斗中接近200%暴击需要计入核心技(?:\d+|未录入)级对应战斗增益、音擎和实际队友增益；不能把200%当初始面板或自动假定增益生效。$/u
const claretSignatureCondition =
  /^当前使用猩红渴望(\d+|未记录)阶；128\.9%暴击只作该精炼的专武配装参考，其他精炼不能直接套用。$/u
const claretOtherEngineCondition =
  '当前不是猩红渴望配置；专武配装的128.9%暴击不作为当前初始暴击目标。'
const pyroisCritCondition = '暴击率按角色特定被动与 1 影生效前的数值计。'
const pyroisCritConditionDisplay = '暴击率目标不包含角色被动与 1 影的加成。'

// Presentation-only exclusions. Each entry is a complete, reviewed sentence;
// partial matching here would risk dropping real thresholds or activation gates.
const nonDecisionConditionSources = new Set([
  '仅沿用已成形的一般培养参考；原来源版本保留，不证明3.3 meta、运行时、Formal、Import或精确DPS。',
  '攻击力 为来源明确标注的可选属性，不参与局外差距比较。',
  '暴击伤害 为来源明确标注的可选属性，不参与局外差距比较。',
  '异常精通 为来源明确标注的可选属性，不参与局外差距比较。',
  '异常掌控 为来源明确标注的可选属性，不参与局外差距比较。',
  '暴击率 为来源明确标注的可选属性，不参与局外差距比较。',
  '沿用一般培养参考；3.3 版本实战效果、最佳配装与精确伤害未确认。',
  '攻击力 为可选属性，不计入局外养成差距。',
  '暴击伤害 为可选属性，不计入局外养成差距。',
  '异常精通 为可选属性，不计入局外养成差距。',
  '异常掌控 为可选属性，不计入局外养成差距。',
  '暴击率 为可选属性，不计入局外养成差距。',
  '生命值、防御力 数值保留为攻略生存参考；本地语义分类不将其作为通用养成要求，不参与局外差距比较，来源未明确标注为可选。',
  '防御力 数值保留为攻略生存参考；本地语义分类不将其作为通用养成要求，不参与局外差距比较，来源未明确标注为可选。',
  '生命值、防御力仅供生存参考；是否必需尚未明确，不计入通用养成差距。',
  '防御力 仅供生存参考；是否必需尚未明确，不计入通用养成差距。',
  '生命值与防御力为基础面板参考，不是该输出方向的毕业目标，不要求专门堆词条。',
])

/** Presentation only: merge reviewed equivalent clauses, keeping all other conditions verbatim. */
export function graduationConditionPresentation(conditions: readonly string[]): string[] {
  const displaySources = [
    ...new Set(
      conditions
        .map((condition) => condition.trim())
        .filter((condition) => condition && !nonDecisionConditionSources.has(condition))
        .map((condition) =>
          condition === pyroisCritCondition ? pyroisCritConditionDisplay : condition,
        ),
    ),
  ]
  const lines = [...new Set(playerConditionLines(displaySources).map((line) => line.text))]
  const output = [...lines]
  const replaceCovered = (anchor: string, covered: string, replacement: string) => {
    const anchorIndex = output.indexOf(anchor)
    const coveredIndex = output.indexOf(covered)
    if (anchorIndex < 0 || coveredIndex < 0) return false
    output[anchorIndex] = replacement
    output.splice(coveredIndex, 1)
    return true
  }

  replaceCovered(
    claretLevelReference,
    claretLevelBoundary,
    '60级养成参考：防御力2300–2600+，生命值9500+；防御力仅作参考，不代表机制满档或最佳配置。',
  )
  const compactLevel =
    '60级养成参考：防御力2300–2600+，生命值9500+；防御力仅作参考，不代表机制满档或最佳配置。'
  replaceCovered(
    compactLevel,
    '生命值列为基础参考，不需要为达标专门堆生命词条。',
    '60级养成参考：防御力2300–2600+，生命值9500+；生命值为基础参考，无需专门堆叠，防御力不代表机制满档或最佳配置。',
  )

  if (output.includes(claretCritReference)) {
    const combat = output.find((line) => claretCombatCondition.test(line))
    if (combat) {
      output[output.indexOf(claretCritReference)] =
        '128.9%暴击率以「猩红渴望」为前提，不能套用于其他音擎。'
      const signature = output.find((line) => claretSignatureCondition.test(line))
      if (signature) {
        const refinement = claretSignatureCondition.exec(signature)![1]
        replaceCovered(
          '128.9%暴击率以「猩红渴望」为前提，不能套用于其他音擎。',
          signature,
          `128.9%暴击率为「猩红渴望」专武参考；当前精炼${refinement === '未记录' ? '未记录' : `${refinement}阶`}，不同精炼及其他音擎不能直接套用。`,
        )
      } else {
        replaceCovered(
          '128.9%暴击率以「猩红渴望」为前提，不能套用于其他音擎。',
          claretOtherEngineCondition,
          '128.9%暴击率为「猩红渴望」专武参考；当前未装备该音擎，不作为当前初始暴击目标。',
        )
      }
    }
  }

  return output
}
