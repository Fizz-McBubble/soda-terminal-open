import { Link } from 'react-router-dom'

export function AgentDevelopmentReadError({ message }: { message: string }) {
  return (
    <section className="panel" role="alert">
      <h1>暂时无法读取养成资料</h1>
      <p>{message}</p>
      <p>请重新加载后再试，现有账户资料不会被清除。</p>
      <button className="button" type="button" onClick={() => window.location.reload()}>
        重新加载
      </button>
      <Link className="button" to="/development">
        返回养成
      </Link>
    </section>
  )
}
