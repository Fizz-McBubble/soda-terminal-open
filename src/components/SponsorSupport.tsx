import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import './SponsorSupport.css'

type Channel = 'alipay' | 'wechat'
type Amount = 'free' | '5' | '10' | '20' | '50' | '100'

const channels: Record<Channel, { label: string }> = {
  alipay: { label: '支付宝' },
  wechat: { label: '微信' },
}

const qrImages: Record<Channel, Record<Amount, string>> = {
  alipay: {
    free: '/sponsor/alipay-qr.png',
    '5': '/sponsor/alipay-5-qr.png',
    '10': '/sponsor/alipay-10-qr.png',
    '20': '/sponsor/alipay-20-qr.png',
    '50': '/sponsor/alipay-50-qr.png',
    '100': '/sponsor/alipay-100-qr.png',
  },
  wechat: {
    free: '/sponsor/wechat-qr.png',
    '5': '/sponsor/wechat-5-qr.png',
    '10': '/sponsor/wechat-10-qr.png',
    '20': '/sponsor/wechat-20-qr.png',
    '50': '/sponsor/wechat-50-qr.png',
    '100': '/sponsor/wechat-100-qr.png',
  },
}

const amounts: { value: Amount; label: string }[] = [
  { value: 'free', label: '随心支持' },
  { value: '5', label: '¥5 来罐汽水' },
  { value: '10', label: '¥10 邦布充能' },
  { value: '20', label: '¥20 六分街夜宵' },
  { value: '50', label: '¥50 终端续航' },
  { value: '100', label: '¥100 长线补给' },
]

type SponsorState = {
  channel: Channel
  amount: Amount
  setChannel: (channel: Channel) => void
  setAmount: (amount: Amount) => void
  openDialog: (channel: Channel, opener: HTMLElement) => void
}

const SponsorContext = createContext<SponsorState | null>(null)

function useSponsor() {
  const state = useContext(SponsorContext)
  if (!state) throw new Error('Sponsor UI must be inside SponsorProvider')
  return state
}

function qrImage(channel: Channel, amount: Amount) {
  return qrImages[channel][amount]
}

function amountHint(amount: Amount, channel: Channel) {
  if (amount === 'free') return `${channels[channel].label} · 随心支持，金额你决定`
  const label = amounts.find((option) => option.value === amount)?.label
  return `${channels[channel].label} · ${label}`
}

function QrImage({ channel, amount }: { channel: Channel; amount: Amount }) {
  return (
    <span className="sponsor-qr" aria-hidden="true">
      <img src={qrImage(channel, amount)} alt="" draggable="false" />
    </span>
  )
}

function Amounts({ compact = false }: { compact?: boolean }) {
  const { amount, setAmount } = useSponsor()
  return (
    <div
      className={`sponsor-amounts ${compact ? 'is-compact' : ''}`}
      role="group"
      aria-label="收款金额"
    >
      {amounts.map((option) => (
        <button
          key={option.value}
          type="button"
          className={amount === option.value ? 'is-selected' : undefined}
          aria-pressed={amount === option.value}
          onClick={() => setAmount(option.value)}
        >
          {compact && option.value !== 'free' ? `¥${option.value}` : option.label}
        </button>
      ))}
    </div>
  )
}

export function SponsorProvider({ children }: { children: ReactNode }) {
  const [channel, setChannel] = useState<Channel>('alipay')
  const [amount, updateAmount] = useState<Amount>('free')
  const [expanded, setExpanded] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement>(null)

  useEffect(() => {
    if (expanded && !dialog.current?.open) dialog.current?.showModal()
  }, [expanded])

  const openDialog = (nextChannel: Channel, trigger: HTMLElement) => {
    opener.current = trigger
    setChannel(nextChannel)
    setExpanded(true)
  }

  const setAmount = (nextAmount: Amount) => {
    updateAmount(nextAmount)
  }

  return (
    <SponsorContext.Provider value={{ channel, amount, setChannel, setAmount, openDialog }}>
      {children}
      <dialog
        className="sponsor-dialog"
        ref={dialog}
        aria-label="支持 Soda Terminal"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close()
        }}
        onClose={() => {
          setExpanded(false)
          opener.current?.focus()
        }}
      >
        <header>
          <strong>支持 Soda Terminal</strong>
          <button type="button" aria-label="关闭收款码" onClick={() => dialog.current?.close()}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="sponsor-dialog__channel" aria-label="收款渠道">
          {(Object.keys(channels) as Channel[]).map((option) => (
            <button
              key={option}
              type="button"
              className={channel === option ? 'is-selected' : undefined}
              aria-pressed={channel === option}
              onClick={() => setChannel(option)}
            >
              {channels[option].label}
            </button>
          ))}
        </div>
        <Amounts compact />
        <QrImage channel={channel} amount={amount} />
        <p role="status">{amountHint(amount, channel)}</p>
        <small>自愿应援 · 所有功能免费</small>
      </dialog>
    </SponsorContext.Provider>
  )
}

export function SponsorSupport() {
  const { amount, openDialog } = useSponsor()
  return (
    <section className="sponsor-support sponsor-support--home" aria-label="自愿支持">
      <div className="sponsor-support__heading">
        <strong>支持 Soda 持续维护</strong>
        <span>自愿应援 · 所有功能免费</span>
      </div>
      <div className="sponsor-support__body">
        <div className="sponsor-support__amounts">
          <Amounts />
          <p role="status">
            {amount === 'free'
              ? '随心支持 · 金额你决定'
              : `${amounts.find((option) => option.value === amount)?.label} · 支付宝或微信都能用`}
          </p>
        </div>
        <div className="sponsor-support__cards" aria-label="收款渠道">
          {(Object.keys(channels) as Channel[]).map((channel) => (
            <button
              className="sponsor-support__card"
              key={channel}
              type="button"
              onClick={(event) => openDialog(channel, event.currentTarget)}
              aria-label={`放大${channels[channel].label}${amount !== 'free' ? ` ¥${amount}` : ''}收款码`}
            >
              <QrImage channel={channel} amount={amount} />
              <span>
                {channels[channel].label}
                {amount !== 'free' ? ` ¥${amount}` : ''}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SponsorRail() {
  const { channel, setChannel, amount, openDialog } = useSponsor()
  return (
    <section className="sponsor-rail" aria-label="支持 Soda">
      <div className="sponsor-rail__channels" role="group" aria-label="收款渠道">
        {(Object.keys(channels) as Channel[]).map((option) => (
          <button
            key={option}
            type="button"
            className={channel === option ? 'is-selected' : undefined}
            aria-pressed={channel === option}
            onClick={() => setChannel(option)}
          >
            {channels[option].label}
          </button>
        ))}
      </div>
      <button
        className="sponsor-rail__qr"
        type="button"
        onClick={(event) => openDialog(channel, event.currentTarget)}
        aria-label={`放大${channels[channel].label}${amount !== 'free' ? ` ¥${amount}` : ''}收款码`}
      >
        <QrImage channel={channel} amount={amount} />
        <small>
          {amount === 'free' ? '随心支持' : `${channels[channel].label} ¥${amount}`} · 点击放大
        </small>
      </button>
    </section>
  )
}
