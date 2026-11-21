import './styles/tokens.css'
import './styles/motion.css'
import './styles/base.css'
import { bootstrapPublicApp } from './main.publicBootstrap'
import { mountInstallerFeedbackIfRequested } from './main.installerFeedback'

if (!mountInstallerFeedbackIfRequested()) {
  bootstrapPublicApp(() => import('./AppCommunity'))
}
