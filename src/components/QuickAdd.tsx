import { useState } from 'react'
import type { Page, Section } from '../types'

type Props = {
  pages: Page[]
  sections: Section[]
  defaultPageId: string
  onAdd: (pageId: string, sectionId: string | null, newSectionTitle: string, text: string) => string
  onClose: () => void
}

const NEW = '__new__'

export default function QuickAdd({ pages, sections, defaultPageId, onAdd, onClose }: Props) {
  const [pageId, setPageId] = useState(defaultPageId)
  const pageSections = sections.filter(s => s.page_id === pageId)
  const [sectionId, setSectionId] = useState<string>(sections.find(s => s.page_id === defaultPageId)?.id ?? NEW)
  const [newTitle, setNewTitle] = useState('')
  const [text, setText] = useState('')
  const [added, setAdded] = useState(0)

  const pickPage = (id: string) => {
    setPageId(id)
    setSectionId(sections.find(s => s.page_id === id)?.id ?? NEW)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    const isNew = sectionId === NEW || !pageSections.some(s => s.id === sectionId)
    const usedSection = onAdd(pageId, isNew ? null : sectionId, newTitle.trim(), v)
    if (isNew) { setSectionId(usedSection); setNewTitle('') } // keep adding into the section just created
    setText('')
    setAdded(n => n + 1)
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="dialog" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h3>הוספה מהירה</h3>
        <input
          autoFocus placeholder="מה צריך לעשות?" value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose() }}
        />
        <div className="row-2">
          <select value={pageId} onChange={e => pickPage(e.target.value)} aria-label="דף">
            {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={sectionId} onChange={e => setSectionId(e.target.value)} aria-label="כותרת">
            {pageSections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            <option value={NEW}>＋ כותרת חדשה…</option>
          </select>
        </div>
        {(sectionId === NEW || pageSections.length === 0) && (
          <input placeholder="שם הכותרת החדשה (ברירת מחדל: כללי)" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
        )}
        <div className="dialog-actions">
          <button className="primary" disabled={!text.trim()}>הוסף</button>
          <button type="button" className="ghost" onClick={onClose}>{added ? 'סיום' : 'ביטול'}</button>
          {added > 0 && <span className="muted small">✓ נוספו {added}</span>}
        </div>
      </form>
    </div>
  )
}
