import { Check } from 'lucide-react'
import './scanner-method-steps.css'

export function ScannerMethodSteps({
  method,
  currentStep,
}: {
  method: '扫描' | '读取'
  currentStep: number
}) {
  return (
    <ol className="scanner-method-steps" aria-label={`${method}步骤`}>
      {['准备', method, '导入'].map((label, index) => {
        const complete = index < currentStep
        const current = index === currentStep
        return (
          <li
            key={label}
            className={complete ? 'is-complete' : current ? 'is-current' : undefined}
            aria-current={current ? 'step' : undefined}
          >
            <span className="scanner-method-steps__number" aria-hidden="true">
              {complete ? <Check size={12} /> : index + 1}
            </span>
            <span>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
