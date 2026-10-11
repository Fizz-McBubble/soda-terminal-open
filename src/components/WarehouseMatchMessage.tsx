import type { WarehouseMatchFeedback } from '../application/warehouseMatchFeedback'

export function WarehouseMatchMessage({ feedback }: { feedback: WarehouseMatchFeedback }) {
  return (
    <>
      <span>{feedback.summary}</span>
      {feedback.details.length ? (
        <details className="warehouse-match-details" data-motion-details>
          <summary>查看缺口</summary>
          <ul>
            {feedback.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  )
}
