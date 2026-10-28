import { useState } from 'react'
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { COLORS, type Page } from '../types'

type Props = {
  pages: Page[]
  activeId: string | null
  onSelect: (id: string) => void
  onAdd: (name: string, color: string) => void
  onUpdate: (id: string, patch: { name?: string; color?: string }) => void
  onDelete: (id: string) => void
}

function SortableTab({ page, active, onClick }: { page: Page; active: boolean; onClick: () => void }) {
  const s = useSortable({ id: page.id, data: { type: 'page' } })
  const c = COLORS[page.color] ?? COLORS.violet
  return (
    <button
      ref={s.setNodeRef} {...s.attributes} {...s.listeners}
      role="tab" aria-selected={active}
      className={'tab' + (active ? ' active' : '') + (s.isDragging ? ' sorting' : '')}
      style={{
        ['--c' as string]: c.hex,
        transform: CSS.Transform.toString(s.transform), transition: s.transition,
      }}
      onClick={onClick}
      title={active ? 'לחץ שוב לעריכת הדף · גרור לסידור' : 'גרור לסידור'}
    >
      <span className="dot" />{page.name}
    </button>
  )
}

export default function Tabs({ pages, activeId, onSelect, onAdd, onUpdate, onDelete }: Props) {
  const [dialog, setDialog] = useState<null | { mode: 'add' } | { mode: 'edit'; page: Page }>(null)

  return (
    <>
      <nav className="tabs" role="tablist">
        <SortableContext items={pages.map(p => p.id)} strategy={horizontalListSortingStrategy}>
          {pages.map(p => (
            <SortableTab
              key={p.id} page={p} active={p.id === activeId}
              onClick={() => (p.id === activeId ? setDialog({ mode: 'edit', page: p }) : onSelect(p.id))}
            />
          ))}
        </SortableContext>
        <button className="tab add" onClick={() => setDialog({ mode: 'add' })} aria-label="דף חדש">+</button>
      </nav>
      {dialog && (
        <PageDialog
          initial={dialog.mode === 'edit' ? dialog.page : null}
          onClose={() => setDialog(null)}
          onSave={(name, color) => {
            if (dialog.mode === 'add') onAdd(name, color)
            else onUpdate(dialog.page.id, { name, color })
            setDialog(null)
          }}
          onDelete={dialog.mode === 'edit' ? () => {
            if (confirm(`למחוק את הדף "${dialog.page.name}" וכל מה שבתוכו?`)) { onDelete(dialog.page.id); setDialog(null) }
          } : undefined}
        />
      )}
    </>
  )
}

function PageDialog({ initial, onSave, onClose, onDelete }: {
  initial: Page | null
  onSave: (name: string, color: string) => void
  onClose: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? 'violet')
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (name.trim()) onSave(name.trim(), color) }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="dialog" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h3>{initial ? 'עריכת דף' : 'דף חדש'}</h3>
        <input autoFocus placeholder="שם הדף (למשל: עבודה)" value={name} onChange={e => setName(e.target.value)} />
        <div className="swatches">
          {Object.entries(COLORS).map(([key, c]) => (
            <button
              type="button" key={key} title={c.name} aria-label={c.name}
              className={'swatch' + (key === color ? ' on' : '')} style={{ background: c.hex }}
              onClick={() => setColor(key)}
            />
          ))}
        </div>
        <div className="dialog-actions">
          <button className="primary" disabled={!name.trim()}>שמור</button>
          {onDelete && <button type="button" className="ghost danger" onClick={onDelete}>מחק דף</button>}
          <button type="button" className="ghost" onClick={onClose}>ביטול</button>
        </div>
      </form>
    </div>
  )
}
