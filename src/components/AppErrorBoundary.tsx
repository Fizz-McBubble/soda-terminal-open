import { Component, type ErrorInfo, type ReactNode } from 'react'

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
          <span className="eyebrow">RECOVERY MODE</span>
          <h1>应用未能正常启动</h1>
          <p>请重新加载页面后再试。此操作不会清除账户资料。</p>
          <div className="app-entry-state__actions">
            <button className="back-navigation" onClick={() => window.location.reload()}>
              重新加载
            </button>
          </div>
          <details>
            <summary>错误详情</summary>
            <code>{this.state.error.message}</code>
          </details>
        </main>
      )
    }

    return this.props.children
  }
}
