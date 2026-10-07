import { CheckCircle2 } from 'lucide-react'
import type { RefObject } from 'react'

export function FormalDiscImportPageSuccess({
  message,
  headingRef,
}: {
  message: string
  headingRef?: RefObject<HTMLHeadingElement | null>
}) {
  return (
    <section className="formal-import-success scanner-inline-import__success" role="status">
      <div className="formal-import-success__mark" aria-hidden="true">
        <CheckCircle2 />
      </div>
      <div className="formal-import-success__copy">
        <h2 ref={headingRef} tabIndex={-1}>
          {message.split('；')[0]}
        </h2>
        <p>{message.split('；').slice(1).join('；')}</p>
      </div>
    </section>
  )
}
