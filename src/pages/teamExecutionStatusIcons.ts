import { CheckCircle2, CircleAlert, Hammer, Wrench } from 'lucide-react'
import type { TeamExecutionPlayerStatus } from './teamExecutionPresentation'

export const statusIcon = {
  direct: CheckCircle2,
  adjust: Wrench,
  confirm: CircleAlert,
  build: Hammer,
} satisfies Record<TeamExecutionPlayerStatus, typeof CheckCircle2>
