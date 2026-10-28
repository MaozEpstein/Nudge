import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, closestCenter, pointerWithin, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { configured, supabase } from './lib/supabase'
import { useData } from './lib/useData'
import { useReminders } from './lib/reminders'
import { beforeIdFor, nextOccurrence } from './lib/recurrence'
import { useCollapsed, useSettings } from './lib/settings'
import { useFlip } from './lib/flip'
import { COLORS, type Repeat, type Task } from './types'
import Login from './components/Login'
import Tabs from './components/Tabs'
import SectionCard from './components/SectionCard'
import AddInline from './components/AddInline'
import ReminderPicker from './components/ReminderPicker'
import SettingsDialog from './components/SettingsDialog'
import SearchDialog from './components/SearchDialog'
import QuickAdd from './components/QuickAdd'
import { formatRemind } from './components/TaskItem'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!configured)

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return <div className="center-screen"><div className="spinner" /></div>
  if (configured && !session) return <Login />
  return <Board userId={session?.user.id ?? 'local'} email={session?.user.email} />
}

// Each drag type only collides with compatible drop targets; for tasks, a task row wins over its section.
const collide: CollisionDetection = args => {
  const type = args.active.data.current?.type
  const accepts = args.droppableContainers.filter(c => {
    const t = c.data.current?.type
    return type === 'task' ? t === 'task' || t === 'taskContainer' : t === type
  })
  const scoped = { ...args, droppableContainers: accepts }
  const hits = pointerWithin(scoped)
  const found = hits.length ? hits : closestCenter(scoped)
  if (type !== 'task') return found
  const row = found.find(h => accepts.find(c => c.id === h.id)?.data.current?.type === 'task')
  return row ? [row] : found.slice(0, 1)
}

type Toast = { message: string; undo?: () => void }
type Ghost = { kind: 'task' | 'section' | 'page'; html: string; width: number; height: number }

function Board({ userId, email }: { userId: string; email?: string }) {
  const data = useData(userId)
  const { pages, sections, tasks } = data
  const [activeId, setActiveId] = useState<string | null>(() => {
    try { return localStorage.getItem('nudge-active') } catch { return null }
  })
  const [remindTask, setRemindTask] = useState<Task | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number>()
  const reminders = useReminders(tasks)
  const [settings, updateSettings] = useSettings()
  const [collapsedMap, setCollapsed] = useCollapsed()
  const [showSettings, setShowSettings] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showQuick, setShowQuick] = useState(false)
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const dragging = useRef(false)
  const dropped = useRef<string | null>(null)
  useFlip(dragging, dropped)

  const active = pages.find(p => p.id === activeId) ?? pages[0] ?? null
  useEffect(() => {
    if (active) try { localStorage.setItem('nudge-active', active.id) } catch { /* ignore */ }
  }, [active?.id])

  const color = COLORS[active?.color ?? 'violet'] ?? COLORS.violet
  const pageSections = sections.filter(s => s.page_id === active?.id)
  const pageSectionIds = new Set(pageSections.map(s => s.id))
  const doneOnPage = tasks.filter(t => t.done && pageSectionIds.has(t.section_id))

  const showToast = (message: string, undo?: () => void) => {
    setToast({ message, undo })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 5000)
  }

  // keyboard shortcuts: N = quick add, / = search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input,textarea,select,[contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.code === 'KeyN' && pages.length) { e.preventDefault(); setShowQuick(true) }
      else if (e.code === 'Slash') { e.preventDefault(); setShowSearch(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pages.length])

  // completing a recurring task re-schedules it instead of closing it
  const toggleTask = (t: Task) => {
    if (!t.done && t.repeat && t.remind_at) {
      const next = nextOccurrence(t.remind_at, t.repeat)
      data.updateTask(t.id, { remind_at: next, done: false })
      showToast(`🔁 חוזרת ב-${formatRemind(next)}`)
    } else data.updateTask(t.id, { done: !t.done })
  }

  const deleteTask = (t: Task) => {
    data.deleteTask(t.id)
    showToast('המשימה נמחקה', () => data.restoreTasks([t]))
  }

  const clearDone = () => {
    const removed = [...doneOnPage]
    data.deleteTasks(removed.map(t => t.id))
    showToast(`נוקו ${removed.length} משימות שבוצעו`, () => data.restoreTasks(removed))
  }

  const saveReminder = (task: Task, iso: string | null, repeat: Repeat | null) =>
    data.updateTask(task.id, { remind_at: iso, repeat: iso ? repeat : null })

  // ---- drag & drop
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )

  // The floating copy that follows the pointer is a clone of the dragged element, so it looks identical.
  const onDragStart = (e: DragStartEvent) => {
    const type = e.active.data.current?.type as Ghost['kind'] | undefined
    const node = document.querySelector<HTMLElement>(`[data-flip="${CSS.escape(String(e.active.id))}"]`)
    if (!type || !node) return
    dragging.current = true
    const clone = node.cloneNode(true) as HTMLElement
    clone.classList.remove('sorting', 'drop-over')
    clone.removeAttribute('style')
    const r = e.active.rect.current.initial ?? node.getBoundingClientRect()
    setGhost({ kind: type, html: clone.outerHTML, width: r.width, height: r.height })
  }

  const endDrag = (id: string | null) => {
    dragging.current = false
    dropped.current = id
    setGhost(null)
    if (id) window.setTimeout(() => { if (dropped.current === id) dropped.current = null }, 500)
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active: a, over } = e
    endDrag(String(a.id))
    if (!over || a.id === over.id) return
    const type = a.data.current?.type
    const id = String(a.id)

    if (type === 'page') {
      data.movePage(id, beforeIdFor(pages.map(p => p.id), id, String(over.id)))
    } else if (type === 'section') {
      data.moveSection(id, beforeIdFor(pageSections.map(s => s.id), id, String(over.id)))
    } else if (type === 'task') {
      const t = tasks.find(x => x.id === id)
      if (!t) return
      const overTask = over.data.current?.type === 'task' ? tasks.find(x => x.id === over.id) : undefined
      const sectionId = overTask ? overTask.section_id : (over.data.current?.sectionId as string)
      // open and done tasks are ordered separately within a section
      const group = tasks.filter(x => x.section_id === sectionId && x.done === t.done)
      let before: string | null
      if (!overTask) before = null
      else if (overTask.done !== t.done) before = t.done ? (group.find(x => x.id !== id)?.id ?? null) : null
      else before = beforeIdFor(group.map(x => x.id), id, overTask.id)
      if (before === id) return
      data.moveTask(id, sectionId, before)
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={collide} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => endDrag(null)}>
      <div
        className={`app layout-${settings.layout} density-${settings.density}`}
        style={{ ['--c' as string]: color.hex, ['--soft-l' as string]: color.soft, ['--ink-l' as string]: color.ink }}
      >
        <header className="topbar">
          <div className="brand">
            <img src={import.meta.env.BASE_URL + 'favicon.svg'} alt="" />
            <span>Nudge</span>
            {data.unsynced && <span className="sync-chip" title="השינויים יישלחו כשיחזור החיבור">⏳ ממתין לסנכרון</span>}
          </div>
          <div className="top-actions">
            <button className="ghost" onClick={() => setShowSearch(true)} aria-label="חיפוש" title="חיפוש ( / )">🔍</button>
            <button className="ghost" onClick={() => setShowSettings(true)} aria-label="הגדרות" title="הגדרות">⚙️</button>
            {configured && (
              <button className="ghost small" onClick={() => supabase.auth.signOut()} title={email}>התנתק</button>
            )}
          </div>
        </header>

        <Tabs
          pages={pages} activeId={active?.id ?? null} onSelect={setActiveId}
          onAdd={(name, c) => setActiveId(data.addPage(name, c).id)}
          onUpdate={data.updatePage} onDelete={data.deletePage}
        />

        <main>
          {!configured && (
            <p className="notice small">מצב מקומי: הנתונים נשמרים רק בדפדפן הזה. חבר Supabase כדי לסנכרן בין מכשירים (ראה README).</p>
          )}
          {data.error && (
            <p className="error-banner" onClick={data.clearError}>⚠️ {data.error} <u>סגור</u></p>
          )}
          {reminders.due.map(t => (
            <div className="reminder-banner" key={t.id}>
              <span>⏰ <b>{t.title}</b></span>
              <span className="banner-actions">
                <button onClick={() => { toggleTask(t); reminders.dismiss(t.id) }}>בוצע</button>
                <button onClick={() => reminders.dismiss(t.id)}>סגור</button>
              </span>
            </div>
          ))}

          {data.loading ? (
            <div className="center-inline"><div className="spinner" /></div>
          ) : !active ? (
            <div className="empty">
              <div className="empty-emoji">🌈</div>
              <h2>בוא נתחיל</h2>
              <p className="muted">צור דף ראשון (למשל: אישי, אוניברסיטה, עבודה) עם כפתור ה־ + למעלה.</p>
            </div>
          ) : (
            <>
              {pageSections.length === 0 && (
                <div className="empty small-empty">
                  <p className="muted">הדף ריק. הוסף כותרת (למשל שם קורס) ואז משימות מתחתיה 👇</p>
                </div>
              )}
              <SortableContext items={pageSections.map(s => s.id)} strategy={() => null}>
                <div className="sections">
                  {pageSections.map(s => {
                    const sTasks = tasks.filter(t => t.section_id === s.id)
                    // auto-collapse a fully completed section unless the user chose otherwise
                    const collapsed = collapsedMap[s.id] ?? (sTasks.length > 0 && sTasks.every(t => t.done))
                    return (
                      <SectionCard
                        key={s.id} section={s}
                        tasks={sTasks}
                        collapsed={collapsed}
                        onToggleCollapsed={() => setCollapsed(s.id, !collapsed)}
                        onRename={title => data.updateSection(s.id, title)}
                        onDelete={() => data.deleteSection(s.id)}
                        onAddTask={title => data.addTask(s.id, title)}
                        onToggle={toggleTask}
                        onEditTask={(t, title) => data.updateTask(t.id, { title })}
                        onDeleteTask={deleteTask}
                        onRemind={setRemindTask}
                      />
                    )
                  })}
                </div>
              </SortableContext>
              <AddInline className="new-section" placeholder="כותרת חדשה (נושא / קורס)…" onAdd={title => data.addSection(active.id, title)} />
              {doneOnPage.length > 0 && (
                <button className="clear-done" onClick={clearDone}>🧹 נקה משימות שבוצעו ({doneOnPage.length})</button>
              )}
            </>
          )}
        </main>

        {active && (
          <button className="fab" onClick={() => setShowQuick(true)} aria-label="הוספה מהירה" title="הוספה מהירה ( N )">+</button>
        )}

        {showSettings && (
          <SettingsDialog settings={settings} userId={userId} onChange={updateSettings} onClose={() => setShowSettings(false)} />
        )}

        {showSearch && (
          <SearchDialog
            pages={pages} sections={sections} tasks={tasks}
            onPick={(pageId, sectionId) => { setActiveId(pageId); setCollapsed(sectionId, false); setShowSearch(false) }}
            onClose={() => setShowSearch(false)}
          />
        )}

        {showQuick && active && (
          <QuickAdd
            pages={pages} sections={sections} defaultPageId={active.id}
            onAdd={(pageId, sectionId, newTitle, text) => {
              const sid = sectionId ?? data.addSection(pageId, newTitle || 'כללי').id
              data.addTask(sid, text)
              setActiveId(pageId)
              return sid
            }}
            onClose={() => setShowQuick(false)}
          />
        )}

        {remindTask && (
          <ReminderPicker
            task={tasks.find(t => t.id === remindTask.id) ?? remindTask}
            onSave={(iso, repeat) => saveReminder(remindTask, iso, repeat)}
            onClose={() => setRemindTask(null)}
          />
        )}

        {toast && (
          <div className="toast">
            {toast.message}
            {toast.undo && <button onClick={() => { toast.undo?.(); setToast(null) }}>↩ בטל</button>}
          </div>
        )}

        <DragOverlay>
          {ghost && (
            <div
              className={'drag-clone ' + ghost.kind} style={{ width: ghost.width, height: ghost.height }}
              dangerouslySetInnerHTML={{ __html: ghost.html }}
            />
          )}
        </DragOverlay>
      </div>
    </DndContext>
  )
}
