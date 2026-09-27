/** Insert into an already sorted bounded list without changing comparator semantics. */
export function insertTopK<T>(
  items: T[],
  candidate: T,
  limit: number,
  compare: (left: T, right: T) => number,
) {
  let low = 0
  let high = items.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (compare(items[middle]!, candidate) <= 0) low = middle + 1
    else high = middle
  }
  if (low >= limit) return
  items.splice(low, 0, candidate)
  if (items.length > limit) items.pop()
}
