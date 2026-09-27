export const maxDiscTagLength = 12
export const maxDiscTags = 8

export function normalizeDiscTag(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeDiscTags(values: string[]) {
  const tags: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const tag = normalizeDiscTag(value)
    if (!tag) continue
    if (tag.length > maxDiscTagLength) {
      throw new Error(`标签不能超过 ${maxDiscTagLength} 个字符。`)
    }
    const key = tag.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
  }
  if (tags.length > maxDiscTags) throw new Error(`每张驱动盘最多添加 ${maxDiscTags} 个标签。`)
  return tags
}

export function addDiscTag(tags: string[], value: string) {
  return normalizeDiscTags([...tags, value])
}

export function removeDiscTag(tags: string[], value: string) {
  const target = normalizeDiscTag(value).toLocaleLowerCase()
  return tags.filter((tag) => tag.toLocaleLowerCase() !== target)
}
