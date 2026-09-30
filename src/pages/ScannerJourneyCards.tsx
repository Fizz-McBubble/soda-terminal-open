import { Check } from 'lucide-react'

export function ScannerJourneyCards({ currentStep }: { currentStep: number }) {
  const steps = [{ label: '准备' }, { label: '扫描' }, { label: '检查' }, { label: '完成' }]

  return (
    <ol className="scanner-journey-cards" aria-label="扫描与导入进度">
      {steps.map((step, index) => {
        const state =
          index < currentStep ? 'complete' : index === currentStep ? 'current' : 'pending'
        return (
          <li
            className={`scanner-journey-card is-${state}`}
            aria-current={state === 'current' ? 'step' : undefined}
            key={step.label}
          >
            <span aria-hidden="true">{state === 'complete' ? <Check size={14} /> : index + 1}</span>
            <div>
              <strong>{step.label}</strong>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
