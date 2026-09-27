import type { FormalDamageWhiteboxResult } from '../calculation/formalWhitebox'

export function FormalDamageWhitebox({ result }: { result: FormalDamageWhiteboxResult }) {
  if (result.status !== 'formal') {
    return (
      <section className="optimizer-formal-gate" aria-label="精确伤害状态" role="status">
        <strong>精确伤害暂不可生成</strong>
        <span>
          {result.reason}。补齐同版本敌人、循环、Buff 与玩家最终属性后，才会在这里显示伤害、DPS
          与展开白盒。
        </span>
        <details>
          <summary>资料与计算条件</summary>
          <p>
            正式白盒会绑定角色/音擎/邦布、敌人与玩法、Buff、技能事件、循环时长、版本来源、方案条件与资产快照；候选仓库分不会越过这道门。
          </p>
        </details>
      </section>
    )
  }

  return (
    <section className="optimizer-formal-gate is-ready" aria-label="正式精确伤害白盒" role="status">
      <h2>正式精确伤害</h2>
      <p>
        总伤害 <strong>{result.totalDamage.toFixed(2)}</strong> · 固定时长 DPS{' '}
        <strong>{result.dps.toFixed(2)}</strong>
      </p>
      <p>
        战前/战斗面板摘要：有效攻击力 {result.effectiveAttack.toFixed(2)} · 期望暴击乘区{' '}
        {result.expectedCritMultiplier.toFixed(2)}。
      </p>
      <details>
        <summary>展开乘区与事件白盒</summary>
        <ul>
          {result.factors.map((factor) => (
            <li key={factor.label}>
              {factor.label}：{factor.value}
            </li>
          ))}
        </ul>
        <p>{result.boundary}</p>
      </details>
    </section>
  )
}
