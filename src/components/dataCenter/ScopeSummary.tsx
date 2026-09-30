import type { PlayerDataSummary } from './dataCenterTypes'

export function ScopeSummary({ title, summary }: { title: string; summary: PlayerDataSummary }) {
  return (
    <section className="data-center-scope-summary" aria-label={title}>
      <h3>{title}</h3>
      <dl>
        <div>
          <dt>角色档案</dt>
          <dd>{summary.agents} 位代理人</dd>
        </div>
        <div>
          <dt>驱动盘</dt>
          <dd>{summary.discs} 张</dd>
        </div>
        <div>
          <dt>驱动盘评价与标签</dt>
          <dd>{summary.evaluations} 条评价</dd>
        </div>
        <div>
          <dt>扫描批次/暂存</dt>
          <dd>
            {summary.scanBatches} 个批次 / {summary.scanItems} 条暂存
          </dd>
        </div>
        <div>
          <dt>已保存配装方案/结果</dt>
          <dd>{summary.optimizationResults} 个</dd>
        </div>
        <div>
          <dt>账户偏好</dt>
          <dd>{summary.preferences} 项</dd>
        </div>
      </dl>
    </section>
  )
}
