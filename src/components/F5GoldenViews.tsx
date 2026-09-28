import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SponsorSupport } from './SponsorSupport'

export type F5JourneyState = 'ready' | 'current' | 'recovery' | 'upcoming'

export type F5HomeJourneyItem = {
  label: string
  description: string
  path: string
  state: F5JourneyState
}

type F5HomeGoldenViewProps = {
  statusLabel: string
  headline: readonly [string, string]
  headlineLabel: string
  supportingCopy: string
  primaryAction: { label: string; route: string }
  nextSignal: { label: string; summary: string }
  heroSrc: string
  discArtUrls: string[]
  readiness: {
    stateLabel: string
    stateTitle: string
    accountName: string
    agentCount: number
    discCount: number
    assetLabel: string
    assetDetail: string
  }
  assetAction: { label: string; disabled: boolean; onClick: () => void }
  assetTools?: ReactNode
  journey: F5HomeJourneyItem[]
}

export function F5HomeGoldenView({
  statusLabel,
  headline,
  headlineLabel,
  supportingCopy,
  primaryAction,
  nextSignal,
  heroSrc,
  discArtUrls,
  readiness,
  assetAction,
  assetTools,
  journey,
}: F5HomeGoldenViewProps) {
  return (
    <div className="soda-home soda-home--golden">
      <section className="home-focus" aria-labelledby="home-next-action-title">
        <div className="focus-copy">
          <div className="home-next-action__context">
            <span>下一步</span>
            <strong>{statusLabel}</strong>
          </div>
          <h1 id="home-next-action-title" aria-label={headlineLabel}>
            <span>{headline[0]}</span>
            <br />
            <em>{headline[1]}</em>
          </h1>
          <p className="home-focus__lead">{supportingCopy}</p>
          <div className="home-focus__actions">
            <Link className="home-primary-action" to={primaryAction.route}>
              {primaryAction.label} <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="home-next-signal" aria-label="接下来">
            <span>接下来</span>
            <div>
              <strong>{nextSignal.label}</strong>
              <p>{nextSignal.summary}</p>
            </div>
          </div>
        </div>

        <figure className="home-scene" data-art-emphasis="cross-layer-large">
          <span className="home-scene__orbit home-scene__orbit--one" aria-hidden="true" />
          <span className="home-scene__orbit home-scene__orbit--two" aria-hidden="true" />
          <img
            className="home-version-hero"
            src={heroSrc}
            alt="蕾米埃尔版本主视觉"
            draggable="false"
          />
        </figure>

        <section
          className="home-readiness"
          id="home-local-readiness"
          aria-labelledby="home-local-status-title"
        >
          <div className="home-readiness__heading">
            <strong id="home-local-status-title">本地资料</strong>
            <b title={readiness.stateTitle}>{readiness.stateLabel}</b>
          </div>
          <dl className="case-rows">
            <div>
              <dt>当前账户</dt>
              <dd title={readiness.accountName}>{readiness.accountName}</dd>
            </div>
            <div>
              <dt>账户资产</dt>
              <dd title={`${readiness.agentCount} 代理人`}>{readiness.agentCount} 代理人</dd>
            </div>
            <div>
              <dt>驱动盘仓库</dt>
              <dd title={`${readiness.discCount} 件`}>{readiness.discCount} 件</dd>
            </div>
          </dl>
          <div className="home-catalog-cache" role="status" title={readiness.assetLabel}>
            {discArtUrls.slice(0, 2).map((url) => (
              <img alt="" aria-hidden="true" key={url} src={url} />
            ))}
            <span>
              <strong>{readiness.assetLabel}</strong>
              <small>{readiness.assetDetail}</small>
            </span>
            <button
              className="home-catalog-cache__action"
              type="button"
              disabled={assetAction.disabled}
              onClick={assetAction.onClick}
            >
              {assetAction.label}
            </button>
          </div>
          {assetTools}
        </section>
        <SponsorSupport />
      </section>

      <section className="home-journey" aria-labelledby="journey-title">
        <header className="home-section-heading">
          <div>
            <h2 id="journey-title">使用旅程</h2>
          </div>
        </header>
        <ol className="journey-list--five">
          {journey.map((step, index) => (
            <li
              className={`journey-item is-${step.state === 'ready' ? 'complete' : step.state === 'recovery' ? 'current' : step.state}`}
              key={step.label}
            >
              <Link aria-current={step.state === 'current' ? 'step' : undefined} to={step.path}>
                <span className="home-journey__number">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                </span>
                <span className="home-journey__copy">
                  <strong>{step.label}</strong>
                  <small>{step.description}</small>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

type F5ScannerGoldenViewProps = {
  runtimeState: string
  visualState: string
  route?: ReactNode
  task: ReactNode
  dialog?: ReactNode
}

export function F5ScannerGoldenView({
  runtimeState,
  visualState,
  route,
  task,
  dialog,
}: F5ScannerGoldenViewProps) {
  return (
    <div
      className={`scanner-golden scanner-golden--${visualState}${route ? '' : ' scanner-golden--without-route'}`}
      data-layout="flex"
      data-scanner-state={runtimeState}
      data-scanner-visual-state={visualState}
    >
      <div className="scanner-golden__workbench">
        {route}
        {task}
      </div>
      {dialog}
    </div>
  )
}
