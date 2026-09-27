import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/motion.css'
import './styles/base.css'
import AppCommunity from './AppCommunity'
import { registerPublicOfflineShell } from './offline/registerPublicOfflineShell'
import { applyRouteStyleScope, waitForRouteStyleScope } from './styles/routeStyles'

const scope = applyRouteStyleScope(window.location.pathname)
void waitForRouteStyleScope(scope).then(
  () => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <AppCommunity />
      </StrictMode>,
    )
    void registerPublicOfflineShell()
  },
  () => {
    const root = document.getElementById('root')!
    root.innerHTML = ''
    const card = document.createElement('main')
    card.setAttribute('role', 'alert')
    card.style.cssText =
      'max-width:32rem;margin:12vh auto;padding:2rem;font:16px/1.6 system-ui,sans-serif;color:#302873;background:#f7f4ff;border:1px solid #dcd6f0;border-radius:16px'
    const title = document.createElement('h1')
    title.textContent = '页面样式暂时无法加载'
    const description = document.createElement('p')
    description.textContent = '请检查网络后重试。浏览器中的本地账户和方案不会因此被清除。'
    const retry = document.createElement('button')
    retry.type = 'button'
    retry.textContent = '重新加载'
    retry.addEventListener('click', () => window.location.reload())
    card.append(title, description, retry)
    root.append(card)
  },
)
