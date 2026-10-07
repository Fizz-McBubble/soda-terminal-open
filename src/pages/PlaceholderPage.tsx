import { ArrowLeft, MapPinOff, ScanLine } from 'lucide-react'
import { Link } from 'react-router-dom'

export function PlaceholderPage() {
  return (
    <section className="f5v-not-found">
      <span className="f5v-not-found__icon" aria-hidden="true">
        <MapPinOff size={28} />
      </span>
      <h1>页面不存在</h1>
      <p>这个链接无效，请检查地址是否完整。你也可以从首页继续，或直接打开扫描与导入。</p>
      <div className="f5v-not-found__actions">
        <Link className="button button--primary" to="/">
          <ArrowLeft size={17} /> 返回首页
        </Link>
        <Link className="button button--ghost" to="/system/scanner">
          <ScanLine size={17} /> 扫描与导入
        </Link>
      </div>
    </section>
  )
}
