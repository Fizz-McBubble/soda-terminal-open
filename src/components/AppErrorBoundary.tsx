import { Component, type ErrorInfo, type ReactNode } from 'react'
import { playerErrorMessage } from '../application/playerErrorMessage'
import './AppEntryState.css'

type State = { error: Error | null }

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Soda Terminal render failure', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="fatal-error" role="alert">
          <h1>页面暂时无法显示</h1>
          <p>请重新加载页面。</p>
          <div className="app-entry-state__actions app-recovery-actions">
            <button className="button button--primary" onClick={() => window.location.reload()}>
              重新加载
            </button>
          </div>
          <details>
            <summary>错误详情</summary>
            <p>{playerErrorMessage(this.state.error, '页面显示发生异常。')}</p>
          </details>
        </main>
      )
    }

    return this.props.children
  }
}
