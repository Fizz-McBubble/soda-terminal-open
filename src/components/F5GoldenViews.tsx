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
  nextSignal: {
    label: string
    summary: string
    hidden?: boolean
    busy?: boolean
    alert?: boolean
    action?: { label: string; onClick: () => void }
  }
  heroSrc: string
  heroSrcSet?: string
  recoveryAction?: { label: string; route: string }
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
  onManageImages: () => void
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
  heroSrcSet,
  recoveryAction,
  discArtUrls,
  readiness,
  assetAction,
  onManageImages,
  assetTools,
  journey,
}: F5HomeGoldenViewProps) {
  const signalState = nextSignal.alert ? 'alert' : nextSignal.busy ? 'busy' : 'idle'

  return (
    <div className="soda-home soda-home--golden">
      <section
        className="home-focus"
        aria-labelledby="home-next-action-title"
        data-signal-state={signalState}
      >
        <div className="focus-copy">
          <div className="home-next-action__context">
            <span>当前阶段</span>
            <strong>{statusLabel}</strong>
          </div>
          <h1
            id="home-next-action-title"
            aria-label={headlineLabel}
            aria-describedby="home-next-action-copy"
          >
            <span>{headline[0]}</span>
            <br />
            <em>{headline[1]}</em>
          </h1>
          <p className="home-focus__lead" id="home-next-action-copy">
            {supportingCopy}
          </p>
          <div className="home-focus__actions">
            <Link className="home-primary-action" to={primaryAction.route}>
              {primaryAction.label} <span aria-hidden="true">→</span>
            </Link>
            {recoveryAction ? (
              <Link className="home-secondary-action" to={recoveryAction.route}>
                {recoveryAction.label}
              </Link>
            ) : null}
          </div>
          {!nextSignal.hidden ? (
            <div
              className={`home-next-signal is-${signalState}`}
              aria-label="接下来"
              role={
                nextSignal.alert
                  ? 'alert'
                  : nextSignal.busy || nextSignal.action
                    ? 'status'
                    : undefined
              }
              aria-busy={nextSignal.busy || undefined}
            >
              <span>{nextSignal.alert || nextSignal.busy ? '当前状态' : '其他入口'}</span>
              <div>
                <strong>{nextSignal.label}</strong>{' '}
                {nextSignal.action ? (
                  <button
                    className="button button--quiet home-secondary-action"
                    type="button"
                    onClick={nextSignal.action.onClick}
                  >
                    {nextSignal.action.label}
                  </button>
                ) : null}
                <p>{nextSignal.summary}</p>
              </div>
            </div>
          ) : null}
        </div>

        <figure className="home-scene" data-art-emphasis="cross-layer-large">
          <span className="home-scene__orbit home-scene__orbit--one" aria-hidden="true" />
          <span className="home-scene__orbit home-scene__orbit--two" aria-hidden="true" />
          <img
            className="home-version-hero"
            src={heroSrc}
            srcSet={heroSrcSet}
            sizes="(max-width: 960px) 90vw, (max-width: 1400px) 530px, (min-width: 1921px) min(36vw, 1035px), 690px"
            width={1536}
            height={2048}
            fetchPriority="high"
            decoding="async"
            alt="首页角色插画"
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
              <dt>已拥有代理人</dt>
              <dd title={`${readiness.agentCount} 名`}>{readiness.agentCount} 名</dd>
            </div>
            <div>
              <dt>已记录驱动盘</dt>
              <dd title={`${readiness.discCount} 张`}>{readiness.discCount} 张</dd>
            </div>
          </dl>
          <div className="home-catalog-cache" title={readiness.assetLabel}>
            {discArtUrls.slice(0, 2).map((url) => (
              <img alt="" aria-hidden="true" key={url} src={url} />
            ))}
            <span role="status">
              <strong>{readiness.assetLabel}</strong>
              <small>{readiness.assetDetail}</small>
            </span>
            <div className="home-catalog-cache__actions">
              <button
                className="home-catalog-cache__action home-catalog-cache__action--download"
                type="button"
                disabled={assetAction.disabled}
                onClick={assetAction.onClick}
              >
                {assetAction.label}
              </button>
              <button
                className="home-catalog-cache__action"
                type="button"
                aria-haspopup="dialog"
                aria-controls="home-asset-dialog"
                onClick={onManageImages}
              >
                管理图片
              </button>
            </div>
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
