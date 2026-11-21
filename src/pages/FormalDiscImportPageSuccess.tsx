import { CheckCircle2 } from 'lucide-react'
import type { RefObject } from 'react'

export function FormalDiscImportPageSuccess({
  heading,
  headingRef,
}: {
  heading: string
  headingRef?: RefObject<HTMLHeadingElement | null>
}) {
  return (
    <section className="formal-import-success scanner-inline-import__success" role="status">
      <div className="formal-import-success__mark" aria-hidden="true">
        <CheckCircle2 />
      </div>
      <div className="formal-import-success__copy">
        <h2 ref={headingRef} tabIndex={-1}>
          {heading}
        </h2>
        <p>其他账户、代理人、邦布、音擎和备份未改动。</p>
      </div>
    </section>
  )
}
