import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Section, Task } from '../types'
import AddInline from './AddInline'
import TaskItem from './TaskItem'

type Props = {
  section: Section
  tasks: Task[]
  onRename: (title: string) => void
  onDelete: () => void
  onAddTask: (title: string) => void
  onToggle: (t: Task) => void
  onEditTask: (t: Task, title: string) => void
  onDeleteTask: (t: Task) => void
  onRemind: (t: Task) => void
  collapsed: boolean
  onToggleCollapsed: () => void
}

export default function SectionCard(p: Props) {
  const [editing, setEditing] = useState(false)
  const sortable = useSortable({ id: p.section.id, data: { type: 'section' } })
  const drop = useDroppable({ id: 'drop-' + p.section.id, data: { type: 'taskContainer', sectionId: p.section.id } })
  const doneCount = p.tasks.filter(t => t.done).length
  const ordered = [...p.tasks.filter(t => !t.done), ...p.tasks.filter(t => t.done)]

  const remove = () => {
    if (p.tasks.length === 0 || confirm(`למחוק את "${p.section.title}" וכל ${p.tasks.length} המשימות שבה?`)) p.onDelete()
  }

  return (
    <section
      ref={node => { sortable.setNodeRef(node); drop.setNodeRef(node) }}
      className={'card' + (p.collapsed ? ' collapsed' : '') + (sortable.isDragging ? ' sorting' : '') + (drop.isOver ? ' drop-over' : '')}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
    >
      <header className="card-head">
        <button
          className="icon-btn chevron" onClick={p.onToggleCollapsed}
          aria-label={p.collapsed ? 'פתח כותרת' : 'כווץ כותרת'} aria-expanded={!p.collapsed}
        >▾</button>
        {editing ? (
          <input
            className="edit-input title-input" autoFocus defaultValue={p.section.title}
            onBlur={e => { setEditing(false); const v = e.target.value.trim(); if (v && v !== p.section.title) p.onRename(v) }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false) }}
          />
        ) : (
          <h2 onClick={() => setEditing(true)} title="לחץ לעריכה">{p.section.title}</h2>
        )}
        {p.tasks.length > 0 && <span className="count">{doneCount}/{p.tasks.length}</span>}
        <button className="icon-btn" onClick={remove} aria-label="מחק כותרת">🗑</button>
        <button
          className="icon-btn handle" ref={sortable.setActivatorNodeRef}
          {...sortable.attributes} {...sortable.listeners} aria-label="גרור לסידור מחדש" title="גרור לסידור מחדש"
        >⠿</button>
      </header>
      {p.tasks.length > 0 && (
        <div className="progress"><div style={{ width: `${(doneCount / p.tasks.length) * 100}%` }} /></div>
      )}
      {!p.collapsed && (
        <>
          <SortableContext items={ordered.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <ul className="tasks">
              {ordered.map(t => (
                <TaskItem
                  key={t.id} task={t}
                  onToggle={() => p.onToggle(t)} onDelete={() => p.onDeleteTask(t)}
                  onEdit={title => p.onEditTask(t, title)} onRemind={() => p.onRemind(t)}
                />
              ))}
            </ul>
          </SortableContext>
          <AddInline placeholder="משימה חדשה…" onAdd={p.onAddTask} />
        </>
      )}
    </section>
  )
}
