export function SavedPlanExecutionRefreshStatus({
  state,
  onRetry,
  detail,
}: {
  state: 'loading' | 'mismatch' | 'error'
  onRetry?: () => void
  detail?: string
}) {
  return (
    <section className="panel status-card" role="status" aria-label="已保存盘面评分">
      <p>
        {state === 'loading'
          ? '正在更新配装评分…'
          : state === 'mismatch'
            ? '重新匹配后可查看新评分。'
            : '评分暂时无法加载。'}
      </p>
      {detail ? <p>{detail}</p> : null}
      {state !== 'loading' && onRetry ? (
        <button className="button button--secondary" type="button" onClick={onRetry}>
          重试读取当前评分
        </button>
      ) : null}
    </section>
  )
}
