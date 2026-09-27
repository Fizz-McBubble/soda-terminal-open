import { PlayerSelect } from '../components/PlayerSelect'
import { useState } from 'react'
import type { BangbooConditionPresentation } from '../application/publicBangbooConditionPresentation'
import { BangbooConditionDetailsView } from './BangbooConditionDetailsView'

export type PlayerConfirmableBangbooOption = {
  bangbooId: string
  name: string
  defaultStars: 1 | 2 | 3 | 4 | 5
  activationStatus?: 'active' | 'inactive' | 'unknown'
  recommendationReason?: string
  activationDetailsByStars?: Partial<Record<1 | 2 | 3 | 4 | 5, BangbooConditionPresentation>>
}

/**
 * An explicit player choice among validated or clearly qualified source options, without assuming why the
 * upstream recommendation has no default identity.
 */
export function PlayerConfirmableBangbooSelector({
  options,
  pending = false,
  onConfirm,
  memberIds = [],
}: {
  options: readonly PlayerConfirmableBangbooOption[]
  pending?: boolean
  memberIds?: readonly string[]
  onConfirm: (selection: { bangbooId: string; bangbooStars: 1 | 2 | 3 | 4 | 5 }) => void
}) {
  const [bangbooId, setBangbooId] = useState('')
  const selected = options.find((option) => option.bangbooId === bangbooId)
  const [bangbooStars, setBangbooStars] = useState<1 | 2 | 3 | 4 | 5>(1)
  const condition = selected?.activationDetailsByStars?.[bangbooStars]

  return (
    <section
      className="team-execution__scheme-control team-execution__scheme-control--confirmation"
      aria-label="确认邦布后生成配装"
    >
      <p>
        {options.length
          ? '请选择要搭配的邦布；星级与队伍条件会在生成配装时核对。'
          : '当前没有可确认的邦布，请先核对本队的邦布搭配条件。'}
      </p>
      <label>
        <span>确认邦布</span>
        <PlayerSelect
          aria-label="确认邦布"
          disabled={pending || !options.length}
          value={bangbooId}
          onChange={(value) => {
            const next = options.find((option) => option.bangbooId === value)
            setBangbooId(value)
            if (next) setBangbooStars(next.defaultStars)
          }}
        >
          <option value="">请选择邦布</option>
          {options.map((option) => (
            <option key={option.bangbooId} value={option.bangbooId}>
              {option.name}
            </option>
          ))}
        </PlayerSelect>
      </label>
      <label>
        <span>邦布星级</span>
        <PlayerSelect
          aria-label="确认邦布星级"
          disabled={pending || !selected}
          value={bangbooStars}
          onChange={(value) => setBangbooStars(Number(value) as 1 | 2 | 3 | 4 | 5)}
        >
          {[1, 2, 3, 4, 5].map((stars) => (
            <option key={stars} value={stars}>
              {stars} 星
            </option>
          ))}
        </PlayerSelect>
      </label>
      <button
        className="primary-action"
        type="button"
        disabled={pending || !selected}
        onClick={() => {
          if (selected) onConfirm({ bangbooId: selected.bangbooId, bangbooStars })
        }}
      >
        确认邦布并生成配装
      </button>
      {selected &&
      memberIds.length === 3 &&
      condition?.bangbooId === bangbooId &&
      condition.stars === bangbooStars ? (
        <BangbooConditionDetailsView condition={condition} />
      ) : null}
    </section>
  )
}
