import type { Repeat } from '../types'

// Next occurrence of a recurring reminder, strictly after "now".
export function nextOccurrence(fromIso: string, repeat: Repeat, now = new Date()): string {
  const d = new Date(fromIso)
  const step = () => {
    if (repeat === 'daily') d.setDate(d.getDate() + 1)
    else if (repeat === 'weekly') d.setDate(d.getDate() + 7)
    else d.setMonth(d.getMonth() + 1)
  }
  step()
  let guard = 0
  while (d <= now && guard++ < 1000) step()
  return d.toISOString()
}

// Given an ordered id list, the id to insert "before" so that dropping `activeId`
// on `overId` behaves like arrayMove (null = place at the end).
export function beforeIdFor(ids: string[], activeId: string, overId: string): string | null {
  const from = ids.indexOf(activeId)
  const to = ids.indexOf(overId)
  if (from >= 0 && from < to) return ids[to + 1] ?? null
  return overId
}
