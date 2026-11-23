import type { FormalDamageWhiteboxResult } from '../calculation/formalWhitebox'

export function FormalDamageWhitebox({ result }: { result: FormalDamageWhiteboxResult }) {
  if (result.status !== 'formal') {
    return (
      <section className="optimizer-formal-gate" aria-label="精确伤害状态" role="status">
        <strong>精确伤害暂不可生成</strong>
        <span>{result.reason}</span>
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
