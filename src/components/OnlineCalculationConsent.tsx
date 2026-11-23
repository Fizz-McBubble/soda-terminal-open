import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { calculationProcessingDisclosures } from '../application/calculationProcessingDisclosure'
import './online-calculation-consent.css'

export function OnlineCalculationConsent({ onAllow }: { onAllow: () => void }) {
  const disclosure = calculationProcessingDisclosures.online
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement | null
    const background = Array.from(document.body.children)
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && !element.contains(dialogRef.current),
      )
      .map((element) => ({ element, inert: element.inert }))
    for (const { element } of background) element.inert = true
    const primaryButton =
      dialogRef.current?.querySelector<HTMLButtonElement>('button.button--primary')
    primaryButton?.focus()
    return () => {
      for (const { element, inert } of background) element.inert = inert
      previousActiveElement.current?.focus?.()
    }
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      navigate('/')
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    )
    if (focusable.length === 0) {
      event.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className="online-calculation-consent-backdrop" onKeyDown={handleKeyDown}>
      <section
        ref={dialogRef}
        className="online-calculation-consent"
        role="dialog"
        aria-modal="true"
        aria-label="在线计算说明"
      >
        <div className="online-calculation-consent__body">
          <strong>首次使用在线计算</strong>
          <p>{disclosure.processing}</p>
          <p>
            {disclosure.retention} {disclosure.storage}
          </p>
          <Link to="/system/help#data">查看数据与隐私说明</Link>
        </div>
        <div className="online-calculation-consent__actions">
          <Link to="/">暂不使用，返回首页</Link>
          <button className="button button--primary" type="button" onClick={onAllow}>
            了解并开始在线计算
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
