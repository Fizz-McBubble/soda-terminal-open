import { getPublicStatLabel } from '../application/publicCandidateLabels'
import type { WarehouseAbsoluteRetentionEvidence } from '../warehouse/discWarehouseEvidence'
import type {
  RetentionBlocker,
  RetentionReasonKind,
} from '../warehouse/absoluteDiscRetentionContract'
import { readableAgentName } from './warehouseFactLabels'

type Use = WarehouseAbsoluteRetentionEvidence['leadingUses'][number]

const reasonLabels: Record<RetentionReasonKind, string> = {
  quality_keep: '副词条品质达线',
  functional_ready: '功能用途已具备',
  try_next_upgrade: '可试下一强化节点',
  quality_borderline: '品质处于边界',
  conditional_use: '用途条件待核对',
  missing_fact: '来源资料待补齐',
  proven_low_ceiling: '强化上界仍不足',
  low_investment_value: '继续投入价值偏低',
  no_supported_use: '支持范围内未证用途',
  invalid_record: '盘记录待核对',
}

function score(value: number) {
  return value.toFixed(1)
}

function branchLabel(profileId?: string) {
  if (!profileId) return null
  const branch = profileId.slice(profileId.indexOf(':') + 1)
  if (branch.startsWith('base-')) return '常规构筑'
  if (branch.startsWith('main-alt-')) return '替代主词构筑'
  if (branch.startsWith('condition-')) return '条件构筑'
  if (branch.startsWith('reviewed-') || branch.startsWith('team-')) return '队伍构筑'
  if (branch === 'two-piece-only') return '两件套构筑'
  return '相关构筑'
}

function readableField(field: string) {
  const stat = getPublicStatLabel(field)
  if (stat && stat !== field) return stat
  const main = /^mainStats\.(\d+)\.([a-z0-9_]+)$/.exec(field)
  if (main) return `${main[1]} 号位·${getPublicStatLabel(main[2]) ?? '主词条'}`
  if (field.startsWith('twoPiece.requires.')) return '两件套使用前提'
  if (field.startsWith('twoPiece.')) return '两件套用途'
  if (field.startsWith('fourPiece.')) return '四件套条件'
  if (field.startsWith('profiles.')) return '角色构筑资料'
  if (field.startsWith('branches.')) return '条件构筑资料'
  const fields: Record<string, string> = {
    mainStat: '主词条',
    setId: '套装',
    slot: '号位',
    rarity: '稀有度',
    level: '强化等级',
    subStats: '副词条',
    sourceCoverage: '资料覆盖',
    policyCalibration: '阈值校准',
    calibration: '清理阈值校准',
    reviewedUseScope: '已审用途范围',
    investment: '阶段投入判断',
    enhancementHistory: '强化记录',
    effectUtility: '套装效果用途',
    functionalTarget: '功能目标',
    numericWeights: '品质标尺',
    cutoffs: '品质阈值',
    'set.twoPieceEffects': '两件套效果来源',
    fourPieceUses: '四件套用途',
    conditionEvidence: '使用条件',
    weightEvidence: '词条权重依据',
  }
  return fields[field] ?? '相关资料字段'
}

function readableDetail(detail: string) {
  const recordMessages: Record<string, string> = {
    invalid_game_rules: '强化规则资料不完整或不一致',
    missing_standard_rarity: '缺少评分所需的 S 级词条资料',
    invalid_rarity_rules: '该稀有度的强化规则需要核对',
    invalid_disc_identity_or_main: '盘编号、号位或主词条需要核对',
    invalid_substat_lines: '副词条数量、重复项或主副词冲突需要核对',
    inconsistent_substat_record: '副词条数值与记录的强化次数不一致',
    inconsistent_enhancement_history: '强化等级与解锁、升级次数不一致',
    no_scoreable_legal_substats: '缺少可用于该构筑评分的合法副词条',
    incomplete_legal_substat_pool: '剩余可解锁的副词条资料不完整',
    unknown_error: '暂时无法读取完整盘记录',
  }
  if (recordMessages[detail]) return recordMessages[detail]
  return detail
    .replace(/\b[a-z0-9_-]+:(?:base-\d+|condition-\d+):[a-f0-9]{8,}\b/gi, '相关构筑')
    .replace(/\b(?:mainStats\.\d+\.[a-z0-9_]+|functionalTarget|numericWeights)\b/g, (field) =>
      readableField(field),
    )
    .replace(/\b[a-z][a-z0-9_]*\b/g, (stat) => getPublicStatLabel(stat) ?? stat)
}

function blockerText(blocker: RetentionBlocker) {
  const branch = branchLabel(blocker.profileId)
  const scope = blocker.agentId
    ? `${readableAgentName(blocker.agentId)}${branch ? `（${branch}）` : ''}`
    : (branch ?? '当前分析范围')
  return `${scope} · ${readableField(blocker.field)}：${readableDetail(blocker.detail)}`
}

function actionLead(evidence: WarehouseAbsoluteRetentionEvidence, discLevel: number) {
  const action = evidence.nextAction
  if (!action) return '下一步：核对这张盘的品质、用途和资料。'
  if (action.kind === 'try_upgrade' && discLevel >= 15) return '下一步：已满级，复核当前结果。'
  const target =
    action.kind === 'try_upgrade' && action.targetLevel !== null ? `至 +${action.targetLevel}` : ''
  const names: Record<typeof action.kind, string> = {
    keep: '保留',
    try_upgrade: `试强化${target}`,
    review_quality: '复核品质',
    check_condition: '核对条件',
    complete_data: '补齐资料',
    manual_cleanup: '人工清理复核',
  }
  return `下一步：${names[action.kind]}。${readableDetail(action.detail)}`
}

function UseLine({ use, owned }: { use: Use; owned: boolean }) {
  const investment = use.investment
  const line = use.cutoffs?.keepFrom
  return (
    <li>
      <strong>{readableAgentName(use.agentId)}</strong>
      {owned ? ' · 已拥有的角色方向' : ' · 未拥有，仅是潜在用途'}
      {' · '}副词条当前 {score(use.currentScore)} 分
      {line !== undefined ? ` / 保留线 ${score(line)} 分` : ' / 保留线待核对'}
      {' · '}合法最终上界 {score(use.possibleFinalScore.upper)} 分
      {use.functionalState === 'ready'
        ? ` · 功能用途已具备${use.functionDetail ? `：${readableDetail(use.functionDetail)}` : ''}`
        : use.functionalState === 'needs_level'
          ? ' · 功能用途仍需强化'
          : use.functionalState === 'needs_build_context'
            ? ' · 功能用途需核对构筑条件'
            : use.functionalMain
              ? ' · 来源支持功能主词条，状态待核对'
              : ''}
      {use.useState === 'conditional' ? ' · 条件用途' : null}
      {use.useState === 'missing_fact' ? ' · 来源不足' : null}
      {investment?.potentialTarget !== null && investment?.potentialTarget !== undefined
        ? ` · 潜力目标 ${score(investment.potentialTarget)} 分`
        : null}
      {investment?.remainingNodes !== undefined
        ? ` · 剩余强化节点 ${investment.remainingNodes} 个`
        : null}
    </li>
  )
}

/** A read-only account projection. The quality score concerns substats; function is separate. */
export function WarehouseRetentionEvidence({
  evidence,
  discLevel,
}: {
  evidence: WarehouseAbsoluteRetentionEvidence
  discLevel: number
}) {
  const uses = evidence.leadingUses
  const blockers = [
    ...new Map(
      [...(evidence.blockedBy ?? []), ...uses.flatMap((use) => use.blockers ?? [])].map(
        (blocker) => [
          `${blocker.profileId ?? ''}|${blocker.field}|${blocker.predicateId}`,
          blocker,
        ],
      ),
    ).values(),
  ]
  const reason = evidence.reasonKind
  const trial = evidence.nextAction?.kind === 'try_upgrade' && discLevel < 15
  const lowInvestment = reason === 'low_investment_value'
  const strictLow = reason === 'proven_low_ceiling'
  return (
    <section aria-label="绝对品质与成长证据">
      <h3>品质与成长</h3>
      <p role="status">
        <strong>{actionLead(evidence, discLevel)}</strong>
      </p>
      {evidence.nextAction?.stopWhen ? (
        <p>停止条件：{readableDetail(evidence.nextAction.stopWhen)}</p>
      ) : null}
      {reason ? (
        <p>
          固有品质判断：<strong>{reasonLabels[reason]}</strong>
        </p>
      ) : null}
      <p>
        {evidence.bestUseScore === null
          ? '尚无可直接确认的副词条品质评分。'
          : `最适用构筑副词条当前品质 ${score(evidence.bestUseScore)} / 100。`}{' '}
        主词条用于判断适配，不重复计入副词条品质分。
      </p>
      {reason === 'functional_ready' ? (
        <p>保留依据是已具备的功能用途；副词条品质与功能完成分别判断。</p>
      ) : null}
      {lowInvestment ? (
        <p>
          停止投入是当前节点的投资判断。剩余强化即使仍有很高的理论上界，也不自动证明值得继续投入或永久保留。
        </p>
      ) : null}
      {strictLow ? (
        <p>
          这是严格上界仍低于相关门槛的判断；请结合下方各构筑的当前分、保留线与合法最终上界核对。
        </p>
      ) : null}
      {trial ? (
        <p>只试到指定等级并按停止条件复核；理论上界达到潜力目标本身不构成保留建议。</p>
      ) : null}
      {uses.length ? (
        <>
          <ul aria-label="主要构筑品质证据">
            {uses.slice(0, 3).map((use) => (
              <UseLine
                key={use.profileId}
                use={use}
                owned={evidence.ownedUseAgentIds.includes(use.agentId)}
              />
            ))}
          </ul>
          {uses.length > 3 ? (
            <details>
              <summary>查看其余 {uses.length - 3} 个构筑方向</summary>
              <ul>
                {uses.slice(3).map((use) => (
                  <UseLine
                    key={use.profileId}
                    use={use}
                    owned={evidence.ownedUseAgentIds.includes(use.agentId)}
                  />
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : (
        <p>现有资料不足以确认适用构筑，需按下一步核对。</p>
      )}
      {blockers.length ? (
        <div role="group" aria-label="全部阻断事实">
          <p>
            <strong>阻断结论的事实（{blockers.length} 项）</strong>
          </p>
          {blockers.length > 3 ? (
            <details>
              <summary>展开全部 {blockers.length} 项条件与资料缺口</summary>
              <ul>
                {blockers.map((blocker, index) => (
                  <li key={`${blocker.predicateId}-${index}`}>{blockerText(blocker)}</li>
                ))}
              </ul>
            </details>
          ) : (
            <ul>
              {blockers.map((blocker, index) => (
                <li key={`${blocker.predicateId}-${index}`}>{blockerText(blocker)}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {evidence.sourceCoverage !== 'complete' && !blockers.length ? (
        <p>相关角色或套装资料覆盖仍有缺口，需核对具体来源。</p>
      ) : null}
      {evidence.policyCalibration !== 'approved' ? (
        <p>清理阈值仍待独立样本校准；当前不会产生清理候选。</p>
      ) : null}
      {evidence.reviewedUseScope ? (
        <p>已核对范围：当前版本已发布角色的来源构筑与机制用途。</p>
      ) : null}
      <details>
        <summary>查看评分口径与来源</summary>
        <p>成长区间是合法强化的上下界，不代表命中概率、伤害或强化建议。</p>
        <p>品质策略：{evidence.policyId}。</p>
        {evidence.reviewedUseScope ? <p>用途范围标识：{evidence.reviewedUseScope}</p> : null}
        {uses.map((use) => (
          <p key={use.profileId}>
            {readableAgentName(use.agentId)} · {branchLabel(use.profileId)} · 来源{' '}
            {use.sourceIds.join('、') || '待补齐'}
            {use.weightEvidence
              ? ` · 权重依据 ${use.weightEvidence.id}（${use.weightEvidence.method}）`
              : ''}
            {use.investment?.policyId ? ` · 投入策略 ${use.investment.policyId}` : ''}
          </p>
        ))}
        {blockers.map((blocker, index) => (
          <p key={`${blocker.predicateId}-${index}`}>
            {readableField(blocker.field)} · 来源 {blocker.sourceIds.join('、') || '待补齐'}
            {' · 判定标识 '}
            {blocker.predicateId}
          </p>
        ))}
      </details>
    </section>
  )
}
