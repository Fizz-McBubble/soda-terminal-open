import { Link } from 'react-router-dom'

export function InvalidPlan({ back, label }: { back: string; label: string }) {
  return (
    <section className="panel result-empty" role="alert">
      <h1>需要先选择配装对象</h1>
      <p>当前链接缺少可用的已拥有{label}，已保留当前账户范围。</p>
      <Link className="primary-action" to={back}>
        返回选择{label}
      </Link>
    </section>
  )
}
