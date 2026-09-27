import { useMemo } from 'react'
import { describeBangbooConditions } from '../decision/bangbooConditionPresentation'
import { BangbooConditionDetailsView } from './BangbooConditionDetailsView'

export function BangbooActivationDetails({
  memberIds,
  bangbooId,
  stars,
}: {
  memberIds: readonly string[]
  bangbooId: string
  stars: number
}) {
  const memberKey = memberIds.join('|')
  const condition = useMemo(
    () =>
      describeBangbooConditions({
        memberIds: memberKey.split('|'),
        bangbooId,
        stars,
      }),
    [memberKey, bangbooId, stars],
  )
  if (!bangbooId) return null
  return <BangbooConditionDetailsView condition={condition} />
}
