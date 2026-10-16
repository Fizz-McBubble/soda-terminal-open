import type { WarehouseMatchFeedback } from '../application/warehouseMatchFeedback'
import { ExplanationPopover } from './ExplanationPopover'

export function WarehouseMatchMessage({ feedback }: { feedback: WarehouseMatchFeedback }) {
  return (
    <>
      <span>{feedback.summary}</span>
      {feedback.details.length ? (
        <ExplanationPopover
          label="查看缺口"
          title="仓库配装缺口"
          className="warehouse-match-explanation"
        >
          <ul>
            {feedback.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </ExplanationPopover>
      ) : null}
    </>
  )
}
