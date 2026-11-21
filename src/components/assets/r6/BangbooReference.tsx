import { useState } from 'react'
import {
  getBangbooCatalogBaseStats,
  getBangbooCatalogSkills,
} from '../../../gameDataPacks/currentEncyclopedia'
import { CatalogEffects, CatalogStats } from './CatalogReferenceShared'
import { SelectMenu } from './SelectMenu'

export function BangbooReferencePanel({
  stableId,
  initialStar,
}: {
  stableId: string
  initialStar: number
}) {
  const [star, setStar] = useState(String(initialStar))
  const [slot, setSlot] = useState('a')
  const groups = getBangbooCatalogSkills(stableId, Number(star))
  const stats = getBangbooCatalogBaseStats(stableId)
  if (!groups.length && !stats.length) return null
  const selectedSlot = groups.some((group) => group.slot === slot) ? slot : 'overview'
  const group = groups.find((entry) => entry.slot === selectedSlot)
  const hasOwnLevelCondition = group?.effects.some((effect) =>
    [effect.description, ...effect.properties.map((property) => property.value)].some((text) =>
      text.includes('自身等级'),
    ),
  )
  return (
    <section
      className="editor-section bangboo-reference catalog-detail-reader"
      aria-label="邦布资料"
    >
      <h3>资料详情</h3>
      <div className="catalog-detail-reader__selectors">
        <label className="field">
          <span>查看内容</span>
          <SelectMenu
            label="查看邦布资料"
            value={selectedSlot}
            options={[
              ...groups.map((entry) => ({ value: entry.slot, label: entry.title })),
              ...(stats.length ? [{ value: 'overview', label: '基础属性 · 60级' }] : []),
            ]}
            onChange={setSlot}
          />
        </label>
        {selectedSlot !== 'overview' && (
          <label className="field">
            <span>查看星级</span>
            <SelectMenu
              label="查看邦布星级效果"
              value={star}
              options={[1, 2, 3, 4, 5].map((value) => ({
                value: String(value),
                label: `${value}星`,
              }))}
              onChange={setStar}
            />
          </label>
        )}
      </div>
      {selectedSlot === 'overview' ? (
        <CatalogStats
          title="基础属性 · 60级"
          label="邦布基础属性"
          stats={stats}
          note="未叠加技能或队伍增益"
        />
      ) : (
        <>
          <p className="catalog-detail-reader__note">
            {selectedSlot === 'b' ? '额外能力随星级查看。' : '按该星级可强化的满级查看。'}
            {hasOwnLevelCondition ? '含“自身等级”的公式保留等级条件。' : null}
          </p>
          <CatalogEffects effects={group?.effects ?? []} />
        </>
      )}
    </section>
  )
}
