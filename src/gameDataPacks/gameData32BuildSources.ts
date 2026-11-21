import type { AgentProfileSourceRef } from './agentProfileFieldProjection'

export const checkedAt = '2026-09-30T12:29:09.2100756Z'
const provenanceBoundary =
  '最小事实提取与来源定位，不复制攻略正文或媒体；来源推荐不是全局强度或 Formal 数值。Gachabase 与锁定上游同根；Prydwen 的 contentHash 标记事实提取 JSON，未冒充原始网页响应哈希。'
type VerifiedBuildSource32 = AgentProfileSourceRef & {
  sourceVersion: '3.2'
  checkedAt: string
  contentHash: string
}

export const gameData32BuildSources: Readonly<Record<string, VerifiedBuildSource32>> =
  Object.freeze({
    claretRelease: {
      id: 'gachabase-release-claret',
      url: 'https://zzz.gachabase.net/agents/1611/claret/release/3.2.0/18761130?lang=en',
      sourceVersion: '3.2',
      checkedAt,
      contentHash: '824763D09A86467208AC596A8AB3446E8941F7D3B3D831FBC9E157147603DF0B',
      licenseBoundary: provenanceBoundary,
    },
    roxyRelease: {
      id: 'gachabase-release-roxy',
      url: 'https://zzz.gachabase.net/agents/1621/roxy/release/3.2.0/18761130?lang=en',
      sourceVersion: '3.2',
      checkedAt,
      contentHash: 'F98A6B5FFBF36BE6C2399499E73EE2408E1E91AC0F32B2317227E7707396BDE9',
      licenseBoundary: provenanceBoundary,
    },
    claretGuide: {
      id: 'prydwen-original-claret32',
      url: 'https://www.prydwen.gg/zenless/characters/claret',
      sourceVersion: '3.2',
      authorReviewedVersion: '3.2',
      checkedAt,
      contentHash: '028F278DA96D0EB8073767A8790FAF55F8D64F018B91296E3CC098876ECF069A',
      licenseBoundary: provenanceBoundary,
    },
    koledaGuide: {
      id: 'prydwen-original-koleda32',
      url: 'https://www.prydwen.gg/zenless/characters/koleda',
      sourceVersion: '3.2',
      authorReviewedVersion: '3.2',
      checkedAt,
      contentHash: 'F40C8569D4AC9586A7AD4826ED3D64715C09FFDECA32043258C28CF4C742975C',
      licenseBoundary: provenanceBoundary,
    },
    koledaLiveBuild32: {
      id: 'hoyobuild-koleda-current-build-20261020',
      url: 'https://hoyobuild.com/en/zzz/characters/koleda',
      sourceVersion: '3.2',
      authorReviewedVersion: null,
      checkedAt: '2026-10-20T07:02:17.826Z',
      contentHash: 'ADB655BE1C8766DD98C63A2B0DB65797217472EFF605B070FD060A30970CE75B',
      licenseBoundary:
        '当次HTTP 200正文UTF-8字节SHA256；采用明确套装、词条和技能方向。页面3.2标签与作者复审版本分开；页面引用Game8/IcyVeins不另计独立来源，不复制正文或媒体。',
    },
    sigridLiveBuild32: {
      id: 'hoyobuild-sigrid-current-conditions-20261020',
      url: 'https://hoyobuild.com/en/zzz/characters/sigrid',
      sourceVersion: '3.2',
      authorReviewedVersion: null,
      checkedAt: '2026-10-20T07:02:19.116Z',
      contentHash: '2EE31BE1F976A554FFE26BB33C68705066D33BEB1579802349B4070C2A28F14D',
      licenseBoundary:
        '当次HTTP 200正文UTF-8字节SHA256；只补充河豚四件的琉音推荐场景及拂晓连段前EX条件，页面引用Prydwen/Game8不另计独立来源，不采用其33.8%为数学满暴上限。',
    },
    roxyGuide: {
      id: 'prydwen-original-roxy32',
      url: 'https://www.prydwen.gg/zenless/characters/roxy',
      sourceVersion: '3.2',
      authorReviewedVersion: '3.2',
      checkedAt: '2026-09-30',
      contentHash: '4781646B6DEB1A7148619A41846AA5AE7B908B5CBC222C279651F638C2596D0D',
      licenseBoundary: provenanceBoundary,
    },
    roxyAlternativesReviewed: {
      id: 'prydwen-roxy32-alternatives-20261011',
      url: 'https://www.prydwen.gg/zenless/characters/roxy',
      sourceVersion: '3.2',
      checkedAt: '2026-10-11',
      contentHash: '363575F9C1FD017C3C85A92051C9E9AD856B4638E9B0BCB777105B43F7F0CF43',
      licenseBoundary:
        '最小事实JSON提取hash，非HTTP原始字节。原攻略Best W-Engines的精炼、队伍及能量条件；不采用伤害/失衡百分比。',
    },
    claretRoxyBangbooReviewed: {
      id: 'zzzgg-roxy32-bangboo-20261011',
      url: 'https://zzz.gg/zh-hans/characters/洛克茜',
      sourceVersion: '3.2',
      checkedAt: '2026-10-11',
      contentHash: '363575F9C1FD017C3C85A92051C9E9AD856B4638E9B0BCB777105B43F7F0CF43',
      licenseBoundary:
        '最小事实JSON提取hash，非HTTP原始字节。原页最佳邦布与队伍搭配的三人成员和可选邦布；不复制正文/媒体，不设默认或精确强度。',
    },
  })
