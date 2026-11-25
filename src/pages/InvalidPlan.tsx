import { Link } from 'react-router-dom'

export function InvalidPlan({ back, label }: { back: string; label: string }) {
  const savedPlan = label === '方案'
  return (
    <section className="panel result-empty" role="alert">
      <h1>{savedPlan ? '这份已保存方案不可用' : '需要先选择配装对象'}</h1>
      <p>
        {savedPlan
          ? '请回到配装页，从当前账户的已保存方案中重新选择。'
          : `当前链接缺少可用的已拥有${label}，已保留当前账户范围。`}
      </p>
      <Link className="primary-action" to={back}>
        {savedPlan ? '返回配装' : `返回选择${label}`}
      </Link>
    </section>
  )
}
