import { Link } from 'react-router-dom'
import { playerErrorMessage } from '../application/playerErrorMessage'
import '../components/AppEntryState.css'

export function AgentDevelopmentReadError({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <section className="panel" role="alert">
      <h1>暂时无法读取养成资料</h1>
      <p>{playerErrorMessage(message, '当前养成资料未能载入。')}</p>
      <p>
        {onRetry
          ? '请重试更新。'
          : '请重新加载后再试。'}
      </p>
      <div className="app-recovery-actions">
        {onRetry ? (
          <button className="button button--primary" type="button" onClick={onRetry}>
            重试更新
          </button>
        ) : null}
        <button
          className={onRetry ? 'button' : 'button button--primary'}
          type="button"
          onClick={() => window.location.reload()}
        >
          重新加载
        </button>
        <Link className="button" to="/development">
          返回养成
        </Link>
      </div>
    </section>
  )
}
