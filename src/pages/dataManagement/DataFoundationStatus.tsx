import { currentN4DataManagementGate } from '../../validation/currentN4DataManagementGate'

export function DataFoundationStatus() {
  return (
    <section className="panel data-foundation-status" aria-labelledby="data-foundation-title">
      <div className="panel__header">
        <div>
          <h2 id="data-foundation-title">数据基础状态</h2>
          <p>查看资料是否齐全、功能是否可靠，以及更新后能否安全恢复。</p>
        </div>
      </div>
      <div className="data-foundation-status__rows">
        {currentN4DataManagementGate.areas.map((area) => (
          <article key={area.id}>
            <div>
              <strong>{area.label}</strong>
              <span className={`data-foundation-status__state is-${area.state}`}>
                {area.state === 'ready'
                  ? '已就绪'
                  : area.state === 'needs_attention'
                    ? '待补充'
                    : '未通过'}
              </span>
            </div>
            <p>{area.summary}</p>
            {area.blockers.length > 0 && (
              <details>
                <summary>查看待处理项（{area.blockers.length}）</summary>
                <ul>
                  {area.blockers.map((blocker, blockerIndex) => (
                    <li key={`${area.id}:${blockerIndex}`}>{blocker}</li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
