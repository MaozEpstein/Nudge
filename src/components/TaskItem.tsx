import { useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { REPEAT_LABELS, type Task } from '../types'

type Props = {
  task: Task
  onToggle: () => void
  onDelete: () => void
  onEdit: (title: string) => void
  onRemind: () => void
}

const THRESHOLD = 90

export const formatRemind = (iso: string) =>
  new Date(iso).toLocaleString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function TaskItem({ task, onToggle, onDelete, onEdit, onRemind }: Props) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const start = useRef<{ x: number; y: number; locked: boolean | null } | null>(null)

  const sortable = useSortable({ id: task.id, data: { type: 'task', sectionId: task.section_id } })

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button,input')) return
    start.current = { x: e.clientX, y: e.clientY, locked: null }
  }
  const onMove = (e: React.PointerEvent) => {
    const s = start.current
    if (!s) return
    const mx = e.clientX - s.x
    const my = e.clientY - s.y
    if (s.locked === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      s.locked = Math.abs(mx) > Math.abs(my) // horizontal swipe vs vertical scroll
      if (s.locked) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
    if (s.locked) { setDragging(true); setDx(mx) }
  }
  const onUp = () => {
    const s = start.current
    start.current = null
    if (!s?.locked) return
    setDragging(false)
    if (Math.abs(dx) > THRESHOLD) {
      setLeaving(true)
      setDx(dx > 0 ? 500 : -500)
      window.setTimeout(onDelete, 220)
    } else setDx(0)
  }

  const reveal = Math.min(Math.abs(dx) / THRESHOLD, 1)

  return (
    <li
      ref={sortable.setNodeRef} data-flip={task.id}
      className={'task-wrap' + (leaving ? ' leaving' : '') + (sortable.isDragging ? ' sorting' : '')}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
    >
      <div className="task-bg" style={{ opacity: reveal }}>🗑 מחק</div>
      <div
        className={'task' + (task.done ? ' done' : '') + (dragging ? ' dragging' : '')}
        style={{ transform: `translateX(${dx}px)` }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      >
        <button className="check" onClick={onToggle} aria-label={task.done ? 'סמן כלא בוצע' : 'סמן כבוצע'}>
          <svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" /></svg>
        </button>
        <div className="task-body" onDoubleClick={() => setEditing(true)}>
          {editing ? (
            <input
              className="edit-input" autoFocus defaultValue={task.title}
              onBlur={e => { setEditing(false); const v = e.target.value.trim(); if (v && v !== task.title) onEdit(v) }}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false) }}
            />
          ) : (
            <span className="task-title" onClick={() => window.matchMedia('(pointer: coarse)').matches && setEditing(true)}>
              {task.title}
            </span>
          )}
          {task.remind_at && !task.done && (
            <span className="chip">
              {task.repeat ? '🔁' : '⏰'} {formatRemind(task.remind_at)}{task.repeat ? ` · ${REPEAT_LABELS[task.repeat]}` : ''}
            </span>
          )}
        </div>
        <button className={'icon-btn bell' + (task.remind_at ? ' on' : '')} onClick={onRemind} aria-label="תזכורת">🔔</button>
        <button className="icon-btn del" onClick={onDelete} aria-label="מחק משימה">✕</button>
        <button
          className="icon-btn handle" ref={sortable.setActivatorNodeRef}
          {...sortable.attributes} {...sortable.listeners} aria-label="גרור לסידור מחדש" title="גרור לסידור מחדש"
        >⠿</button>
      </div>
    </li>
  )
}
