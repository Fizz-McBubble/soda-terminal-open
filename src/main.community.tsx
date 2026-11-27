import './styles/tokens.css'
import './styles/motion.css'
import './styles/base.css'
import { bootstrapPublicApp } from './main.publicBootstrap'
import { mountInstallerFeedbackIfRequested } from './main.installerFeedback'

if (!mountInstallerFeedbackIfRequested()) {
  bootstrapPublicApp(() => import('./AppCommunity'))
  const pathname = window.location.pathname
  const route = pathname.replace(/\/+$/, '')
  if (route === '/loadouts/team' || route === '/warehouse/discs') {
    void import('./application/publicBrowserCalculationClient')
      .then(({ preparePublicCalculationForInitialRoute }) =>
        preparePublicCalculationForInitialRoute(pathname),
      )
      .catch(() => {
        // The route still starts the Worker normally if early preparation fails.
      })
  }
}
