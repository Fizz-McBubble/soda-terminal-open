import { useState, type ReactNode } from 'react'
import {
  getAgentCatalogCore,
  getAgentCatalogMindscapes,
  getAgentCatalogPotential,
  getAgentCatalogSkillOptions,
  getAgentCatalogSkills,
} from '../../../gameDataPacks/currentEncyclopedia'
import { CatalogEffects } from './CatalogReferenceShared'
import { SelectMenu } from './SelectMenu'
import type { AgentReferenceProgress } from './types'

export function AgentSkillReference({
  stableId,
  progress,
  overview,
}: {
  stableId: string
  progress?: AgentReferenceProgress
  overview?: () => ReactNode
}) {
  const [slot, setSlot] = useState('basic')
  const [viewLevels, setViewLevels] = useState<Record<string, number>>({})
  const [viewPotential, setViewPotential] = useState<number | null>(null)
  const potentialEffects = getAgentCatalogPotential(stableId)
  const mindscapes = getAgentCatalogMindscapes(stableId)
  const isSkill = !['mindscape', 'potential', 'overview'].includes(slot)
  const skillOptions = [
    ...getAgentCatalogSkillOptions(stableId),
    { value: 'core', label: '核心技与额外能力' },
    ...(mindscapes.length ? [{ value: 'mindscape', label: '影画效果' }] : []),
    ...(potentialEffects.length ? [{ value: 'potential', label: '潜能效果' }] : []),
    ...(overview ? [{ value: 'overview', label: '身份与基础属性' }] : []),
  ]
  const maximum =
    slot === 'mindscape'
      ? mindscapes.length
      : slot === 'potential'
        ? potentialEffects.length
        : slot === 'core'
          ? 7
          : 16
  const recordedLevel =
    slot === 'mindscape'
      ? progress?.mindscape
      : slot === 'potential'
        ? progress?.potentialImage
        : progress?.skillLevels[slot as keyof AgentReferenceProgress['skillLevels']]
  const level = viewLevels[slot] ?? Math.max(1, recordedLevel ?? 1)
  const potential = viewPotential ?? progress?.potentialImage ?? 0
  const effects =
    slot === 'mindscape'
      ? mindscapes.slice(level - 1, level)
      : slot === 'potential'
        ? potentialEffects.slice(level - 1, level)
        : slot === 'overview'
          ? []
          : slot === 'core'
            ? getAgentCatalogCore(stableId, level, potential)
            : (getAgentCatalogSkills(stableId, level, potential, slot)[0]?.effects ?? [])
  return (
    <section className="editor-section agent-reference__skills" aria-label="代理人资料">
      <h3>资料详情</h3>
      <div className="catalog-detail-reader__selectors">
        <label className="field">
          <span>资料内容</span>
          <SelectMenu
            label="查看代理人资料"
            value={slot}
            options={skillOptions}
            onChange={setSlot}
          />
        </label>
        {slot !== 'overview' && (
          <label className="field">
            <span>{isSkill ? '查看等级' : '查看阶段'}</span>
            <SelectMenu
              label={
                slot === 'mindscape'
                  ? '查看影画阶段'
                  : slot === 'potential'
                    ? '查看潜能阶段'
                    : '查看代理人技能等级'
              }
              value={String(level)}
              options={Array.from({ length: maximum }, (_, index) => ({
                value: String(index + 1),
                label: isSkill
                  ? `Lv.${index + 1}`
                  : `${slot === 'mindscape' ? '影画' : '潜能'} ${index + 1}`,
              }))}
              onChange={(value) => setViewLevels({ ...viewLevels, [slot]: Number(value) })}
            />
          </label>
        )}
        {isSkill && potentialEffects.length > 0 && (
          <label className="field">
            <span>查看潜能</span>
            <SelectMenu
              label="查看代理人潜能等级"
              value={String(potential)}
              options={Array.from({ length: 7 }, (_, index) => ({
                value: String(index),
                label: `潜能 ${index}`,
              }))}
              onChange={(value) => setViewPotential(Number(value))}
            />
          </label>
        )}
      </div>
      {slot === 'overview' ? (
        overview?.()
      ) : (
        <>
          <div className="agent-reference__effects" data-skill-slot={slot} data-skill-level={level}>
            <CatalogEffects effects={effects} />
            {slot === 'core' && (
              <p className="catalog-detail-reader__note">核心强化属性为所选等级的累计值。</p>
            )}
          </div>
        </>
      )}
    </section>
  )
}
