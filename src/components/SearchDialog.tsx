import { useMemo, useState } from 'react'
import { COLORS, type Page, type Section, type Task } from '../types'

type Props = {
  pages: Page[]
  sections: Section[]
  tasks: Task[]
  onPick: (pageId: string, sectionId: string) => void
  onClose: () => void
}

export default function SearchDialog({ pages, sections, tasks, onPick, onClose }: Props) {
  const [q, setQ] = useState('')

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    return tasks
      .filter(t => t.title.toLowerCase().includes(needle))
      .map(t => {
        const section = sections.find(s => s.id === t.section_id)
        const page = pages.find(p => p.id === section?.page_id)
        return section && page ? { task: t, section, page } : null
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .slice(0, 50)
  }, [q, pages, sections, tasks])

  return (
    <div className="overlay top" onClick={onClose}>
      <div className="dialog search" onClick={e => e.stopPropagation()}>
        <input
          autoFocus placeholder="חיפוש משימה בכל הדפים…" value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose() }}
        />
        <ul className="results">
          {results.map(({ task, section, page }) => (
            <li key={task.id}>
              <button onClick={() => onPick(page.id, section.id)}>
                <span className={'r-check' + (task.done ? ' done' : '')}>{task.done ? '✓' : ''}</span>
                <span className="r-main">
                  <span className={'r-title' + (task.done ? ' done' : '')}>{task.title}</span>
                  <span className="r-where">
                    <i style={{ background: (COLORS[page.color] ?? COLORS.violet).hex }} />
                    {page.name} › {section.title}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {q.trim() && results.length === 0 && <li className="muted small empty-res">לא נמצאו משימות</li>}
        </ul>
      </div>
    </div>
  )
}
