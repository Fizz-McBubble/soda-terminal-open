import { useState } from 'react'
import { getCurrentWEngineStaticData } from '../../../gameDataPacks/currentWEngineStaticCatalog'
import { getReviewedWEngineDisplay } from '../../../gameDataPacks/reviewedWEngineDisplay32'
import { EffectDescription } from '../../EffectDescription'
import { SelectMenu } from './SelectMenu'

const statNames = {
  hp_: '生命值',
  atk_: '攻击力',
  pen_: '穿透率',
  def_: '防御力',
  crit_: '暴击率',
  crit_dmg_: '暴击伤害',
  anomProf: '异常精通',
  impact_: '冲击力',
  enerRegen_: '能量自动回复',
  anomMas_: '异常掌控',
}

export function WEngineReferencePanel({ stableId }: { stableId: string }) {
  const [refinement, setRefinement] = useState('1')
  const item = getCurrentWEngineStaticData(stableId)
  const display = getReviewedWEngineDisplay(stableId)
  if (!item || !display) return null
  const stats = item.staticStats
  const percent = stats.secondaryStatKey.endsWith('_')
  const secondary = Number((stats.level60SecondaryValue * (percent ? 100 : 1)).toFixed(2))
  const effect = display.refinements.find((entry) => String(entry.refinement) === refinement)!
  return (
    <>
      <section className="editor-section wengine-reference" aria-label="音擎图鉴属性">
        <h3>图鉴属性 · 60级</h3>
        <dl className="wengine-reference__stats">
          <div>
            <dt>{stats.level60BaseStat.key === 'def' ? '基础防御力' : '基础攻击力'}</dt>
            <dd>{stats.level60BaseStat.value}</dd>
          </div>
          <div>
            <dt>{statNames[stats.secondaryStatKey]}</dt>
            <dd>
              {secondary}
              {percent ? '%' : ''}
            </dd>
          </div>
        </dl>
      </section>
      <section className="editor-section wengine-reference" aria-label="音擎装备效果">
        <div className="wengine-reference__heading">
          <h3>装备效果</h3>
          <SelectMenu
            label="查看音擎精炼效果"
            value={refinement}
            options={[1, 2, 3, 4, 5].map((value) => ({
              value: String(value),
              label: `精炼 ${value}`,
            }))}
            onChange={setRefinement}
          />
        </div>
        <p className="wengine-reference__requirement">
          <EffectDescription text={display.specialtyRequirement} />
        </p>
        <strong className="wengine-reference__name">{effect.name}</strong>
        <p className="wengine-reference__effect">
          <EffectDescription text={effect.description} />
        </p>
      </section>
    </>
  )
}
