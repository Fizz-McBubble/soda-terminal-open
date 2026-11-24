import { VisualEntityImage } from '../components/VisualEntityImage'
import { playerFacingBangbooLabel } from '../application/playerFacingLabels'
import { ExplanationPopover } from '../components/ExplanationPopover'
import type { TeamLoadoutOverviewItem } from './teamLoadoutOverviewTypes'
import { formatBangbooCardDisplay } from './teamBangbooPresentation'
import { describeBangbooConditions } from '../decision/bangbooConditionPresentation'
import { playerFacingAgentLabel } from '../application/playerFacingLabels'
import { bangbooBaseSkillLevelForStars } from '../gameDataPacks/bangbooPlanningBaseline'
import { EffectDescription } from '../components/EffectDescription'

type BangbooOption = NonNullable<TeamLoadoutOverviewItem['bangbooSuggestions']>[number]

export function TeamBangbooSuggestions({
  options,
  memberIds,
  selectedBangbooId,
  selectedBangbooLabel,
  selectedBangbooStars,
  selectedBangbooStarLabel = '当前',
  selectedOption,
  onSelect,
  accountStarsById,
}: {
  options: NonNullable<TeamLoadoutOverviewItem['bangbooSuggestions']>
  memberIds?: readonly string[]
  selectedBangbooId?: string | null
  selectedBangbooLabel?: string
  selectedBangbooStars?: 1 | 2 | 3 | 4 | 5
  selectedBangbooStarLabel?: '当前' | '方案'
  selectedOption?: BangbooOption | null
  onSelect?: (bangbooId: string) => void
  accountStarsById?: Readonly<Record<string, 1 | 2 | 3 | 4 | 5>>
}) {
  const selectedFallback =
    selectedBangbooId && !options.some((option) => option.bangbooId === selectedBangbooId)
      ? (selectedOption ?? {
          bangbooId: selectedBangbooId,
          defaultStars: 0,
          recommendationReason: '',
        })
      : null
  const selectedDisplay =
    selectedOption ??
    options.find((option) => option.bangbooId === selectedBangbooId) ??
    selectedFallback
  const ordered =
    selectedDisplay && !options.some((option) => option.bangbooId === selectedDisplay.bangbooId)
      ? [selectedDisplay, ...options]
      : options.map((option) =>
          option.bangbooId === selectedDisplay?.bangbooId ? selectedDisplay : option,
        )
  const seen = new Set<string>()
  const visibleOptions: BangbooOption[] = []
  for (const option of ordered) {
    if (seen.has(option.bangbooId)) continue
    seen.add(option.bangbooId)
    visibleOptions.push(option)
    if (visibleOptions.length === 3) break
  }
  if (!visibleOptions.length) return null
  return (
    <section className="f5v-box-team-bangboo-options" aria-label="可搭配邦布">
      <div className="f5v-box-team-bangboo-header">
        <h3>邦布推荐</h3>
      </div>
      <ul className="f5v-box-team-bangboo-list" aria-label="邦布推荐">
        {visibleOptions.map((option) => {
          const { bangbooId, defaultStars } = option
          const name =
            bangbooId === selectedBangbooId && selectedBangbooLabel
              ? selectedBangbooLabel
              : playerFacingBangbooLabel(bangbooId)
          const isSelected = bangbooId === selectedBangbooId
          const actualStars =
            isSelected && selectedBangbooStarLabel === '方案'
              ? selectedBangbooStars
              : (accountStarsById?.[bangbooId] ?? (isSelected ? selectedBangbooStars : undefined))
          const explanationStars = actualStars || defaultStars
          const baseSkillLevel = bangbooBaseSkillLevelForStars(explanationStars)
          const details =
            memberIds && baseSkillLevel !== null
              ? describeBangbooConditions({ memberIds, bangbooId, stars: explanationStars })
              : null
          const display = formatBangbooCardDisplay({
            ...option,
            activationStatus: details?.activationStatus ?? option.activationStatus,
            recommendationReason: details?.purposeSummary ?? option.recommendationReason,
          })
          const matchingMembers = [
            ...new Set(
              details?.requirements.flatMap((requirement) => requirement.matchingMemberIds) ?? [],
            ),
          ]
          const starText = actualStars
            ? `${isSelected ? selectedBangbooStarLabel : '当前'}${actualStars}星`
            : defaultStars
              ? `推荐${defaultStars}星`
              : null
          return (
            <li
              key={bangbooId}
              className={isSelected ? 'is-selected' : undefined}
              aria-label={isSelected ? `${name}，已选中` : undefined}
              title={display.fullReason || undefined}
              data-current-selection={isSelected ? 'true' : undefined}
            >
              {onSelect ? (
                <button
                  className="f5v-box-team-bangboo-select"
                  type="button"
                  aria-label={`选择${name}`}
                  aria-pressed={isSelected}
                  data-bangboo-id={bangbooId}
                  onClick={() => onSelect(bangbooId)}
                />
              ) : null}
              <div className="f5v-box-team-bangboo-portrait">
                <VisualEntityImage
                  entityType="bangboo"
                  entityId={bangbooId}
                  name={name}
                  slotId="bangboo.team-icon"
                  consumer="box.team-overview"
                />
                {starText ? (
                  <span
                    className={`f5v-box-team-mindscape-badge ${
                      actualStars ? 'is-recorded' : 'is-reference_only'
                    }`}
                    aria-label={starText}
                    title={starText}
                  >
                    {actualStars ?? defaultStars}
                  </span>
                ) : null}
              </div>
              <div className="f5v-box-team-bangboo-title">
                <span className="f5v-box-team-bangboo-identity">
                  <span>{name}</span>
                </span>
                {display.statusBadge ? (
                  <span
                    className={`f5v-box-team-bangboo-status f5v-box-team-bangboo-status--${
                      display.statusBadge === '未激活' ? 'inactive' : 'unknown'
                    }`}
                  >
                    {display.statusBadge}
                  </span>
                ) : null}
              </div>
              {option.primaryPurpose ? (
                <small className="f5v-box-team-bangboo-purpose">{display.shortPurpose}</small>
              ) : null}
              {display.fullReason || details?.sourceUrl ? (
                <ExplanationPopover
                  label="适配说明"
                  title={`${name} 适配说明`}
                  className="f5v-box-team-bangboo-explanation"
                  variant="button"
                >
                  {display.fullReason ? (
                    <p>
                      <EffectDescription text={display.fullReason} />
                    </p>
                  ) : null}
                  {details?.sourceUrl ? (
                    <>
                      <p>
                        额外能力条件（按
                        {actualStars ? (isSelected ? selectedBangbooStarLabel : '当前') : '推荐'}
                        {explanationStars}星核对）：{details.requirementSummary}。
                        {details.activationStatus === 'unknown' ? '' : details.progressSummary}
                      </p>
                      {matchingMembers.length ? (
                        <p>
                          符合条件的队伍成员：
                          {matchingMembers.map(playerFacingAgentLabel).join('、')}。
                        </p>
                      ) : null}
                      {details.additionalAbility ? (
                        <p>
                          额外能力 · {details.additionalAbility.name}：
                          <EffectDescription text={details.additionalAbility.description} />
                        </p>
                      ) : null}
                      {details.baseSkills.map((skill) => (
                        <p key={skill.kind}>
                          {skill.label} · {skill.name}：
                          <EffectDescription text={skill.description} />
                        </p>
                      ))}
                    </>
                  ) : null}
                </ExplanationPopover>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
