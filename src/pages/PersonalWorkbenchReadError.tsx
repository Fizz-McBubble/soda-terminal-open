import { AgentDevelopmentReadError } from './AgentDevelopmentReadError'

export function PersonalWorkbenchReadError({ onRetry }: { onRetry: () => void }) {
  return <AgentDevelopmentReadError message="个人搭配预览暂不可用。" onRetry={onRetry} />
}
