import { Link } from 'react-router-dom'
import { playerErrorMessage } from '../application/playerErrorMessage'
import '../components/AppEntryState.css'

export function AgentDevelopmentReadError({ message }: { message: string }) {
  return (
    <section className="panel" role="alert">
      <h1>暂时无法读取养成资料</h1>
      <p>{playerErrorMessage(message, '当前养成资料未能载入。')}</p>
      <p>请重新加载后再试，现有账户资料不会被清除。</p>
      <div className="app-recovery-actions">
        <button
          className="button button--primary"
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
