import './styles/tokens.css'
import './styles/motion.css'
import './styles/base.css'
import { mountPublicApp } from './main.publicBootstrap'
import { mountInstallerFeedbackIfRequested } from './main.installerFeedback'
import { showStartupRecovery } from './startupRecovery'

if (!mountInstallerFeedbackIfRequested()) {
  void import('./AppCommunity')
    .then(({ default: AppCommunity }) => mountPublicApp(AppCommunity))
    .catch(() => showStartupRecovery())
}
