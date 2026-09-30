import type { RefObject } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
export function FormalImportSuccess({
  headingRef,
  message,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>
  message: string
}) {
  return (
    <div
      className="page-stack data-center-page"
      data-import-state="success"
      aria-labelledby="formal-success-heading"
    >
      <section
        className="formal-import-success"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="formal-import-success__mark" aria-hidden="true">
          <CheckCircle2 />
        </div>
        <div className="formal-import-success__copy">
          <h1 ref={headingRef} id="formal-success-heading" tabIndex={-1}>
            {message.split('；')[0]}
          </h1>
          <p className="formal-import-success__lead">仓库已按本次扫描结果更新。</p>
          <p className="formal-import-success__scope">未影响其他账户、代理人、邦布、音擎或备份。</p>
        </div>
        <div className="formal-import-success__actions" aria-label="导入完成后的操作">
          <Link
            className="button button--primary formal-import-success__primary"
            to="/assets/discs"
          >
            查看我的驱动盘
          </Link>
          <Link
            className="button button--quiet formal-import-success__secondary"
            to="/system/scanner"
          >
            再次扫描
          </Link>
        </div>
      </section>
    </div>
  )
}
