import { useState } from 'react'
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
}

export default function SectionCard(p: Props) {
  const [editing, setEditing] = useState(false)
  const doneCount = p.tasks.filter(t => t.done).length
  const open = p.tasks.filter(t => !t.done)
  const done = p.tasks.filter(t => t.done)

  const remove = () => {
    if (p.tasks.length === 0 || confirm(`למחוק את "${p.section.title}" וכל ${p.tasks.length} המשימות שבה?`)) p.onDelete()
  }

  return (
    <section className="card">
      <header className="card-head">
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
      </header>
      {p.tasks.length > 0 && (
        <div className="progress"><div style={{ width: `${(doneCount / p.tasks.length) * 100}%` }} /></div>
      )}
      <ul className="tasks">
        {[...open, ...done].map(t => (
          <TaskItem
            key={t.id} task={t}
            onToggle={() => p.onToggle(t)} onDelete={() => p.onDeleteTask(t)}
            onEdit={title => p.onEditTask(t, title)} onRemind={() => p.onRemind(t)}
          />
        ))}
      </ul>
      <AddInline placeholder="משימה חדשה…" onAdd={p.onAddTask} />
    </section>
  )
}
