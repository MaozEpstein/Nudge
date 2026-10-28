import { useLayoutEffect, useRef, type MutableRefObject } from 'react'

// FLIP animation: after every render, elements marked data-flip="<id>" that changed position
// glide from their old spot to the new one (reorders, moves between sections, collapses, deletions).
// `dragging` pauses it while a drag is in progress; `skipId` is the dropped item (the drag overlay animates it).
export function useFlip(dragging: MutableRefObject<boolean>, skipId: MutableRefObject<string | null>) {
  const prev = useRef(new Map<string, { x: number; y: number }>())
  const viewport = useRef('')

  useLayoutEffect(() => {
    if (dragging.current) return // keep pre-drag positions as the reference
    const vp = `${window.innerWidth}x${window.innerHeight}`
    const animate = viewport.current === vp && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const next = new Map<string, { x: number; y: number }>()
    document.querySelectorAll<HTMLElement>('[data-flip]').forEach(el => {
      const id = el.dataset.flip!
      const r = el.getBoundingClientRect()
      const pos = { x: r.left + window.scrollX, y: r.top + window.scrollY }
      next.set(id, pos)
      const old = prev.current.get(id)
      if (!animate || !old || id === skipId.current) return
      const dx = old.x - pos.x
      const dy = old.y - pos.y
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      )
    })
    prev.current = next
    viewport.current = vp
  })
}
