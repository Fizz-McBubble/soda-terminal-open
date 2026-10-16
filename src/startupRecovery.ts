/** Can render before React, route styles, or the business module are available. */
export function showStartupRecovery(
  stage: 'application' | 'styles' = 'application',
  reload = () => window.location.reload(),
) {
  const root = document.getElementById('root')
  if (!root) return
  const card = document.createElement('main')
  card.setAttribute('role', 'alert')
  card.style.cssText =
    'max-width:32rem;margin:12vh auto;padding:2rem;font:16px/1.6 system-ui,sans-serif;color:#302873;background:#f7f4ff;border:1px solid #dcd6f0;border-radius:16px'
  const title = document.createElement('h1')
  title.textContent = stage === 'styles' ? '页面样式暂时无法加载' : '页面暂时无法加载'
  const description = document.createElement('p')
  description.textContent =
    '网络可能暂时不稳定，请稍后重新加载。本地账户和方案仍保存在此浏览器中，请勿清除网站数据。'
  const retry = document.createElement('button')
  retry.type = 'button'
  retry.textContent = '重新加载'
  retry.addEventListener('click', reload)
  card.append(title, description, retry)
  root.replaceChildren(card)
}
