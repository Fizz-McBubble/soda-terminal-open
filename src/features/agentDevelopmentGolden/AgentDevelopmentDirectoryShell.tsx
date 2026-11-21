import { useRef, type ComponentProps } from 'react'
import { useStateTransitionMotion } from '../../motion/useStateTransitionMotion'
import { AgentDevelopmentOverview } from './AgentDevelopmentOverview'
import './styles.css'

/** Directory route entry; loading it does not load the workbench or comparison views. */
export function AgentDevelopmentDirectoryShell(
  props: ComponentProps<typeof AgentDevelopmentOverview>,
) {
  const routeRef = useRef<HTMLDivElement>(null)
  useStateTransitionMotion({
    scope: routeRef,
    stateKey: `overview:${props.directoryAgents.length}`,
    includeScope: true,
    animateOnMount: true,
    transition: 'route',
  })
  return (
    <div ref={routeRef} className="ad-golden" data-development-view="overview">
      <AgentDevelopmentOverview {...props} />
    </div>
  )
}
