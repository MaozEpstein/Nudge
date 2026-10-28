import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configured, supabase } from './lib/supabase'
import { useData } from './lib/useData'
import { useReminders } from './lib/reminders'
import { COLORS, type Task } from './types'
import Login from './components/Login'
import Tabs from './components/Tabs'
import SectionCard from './components/SectionCard'
import AddInline from './components/AddInline'
import ReminderPicker from './components/ReminderPicker'
import SettingsDialog from './components/SettingsDialog'
import { useCollapsed, useSettings } from './lib/settings'

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

function Board({ userId, email }: { userId: string; email?: string }) {
  const data = useData(userId)
  const { pages, sections, tasks } = data
  const [activeId, setActiveId] = useState<string | null>(() => {
    try { return localStorage.getItem('nudge-active') } catch { return null }
  })
  const [remindTask, setRemindTask] = useState<Task | null>(null)
  const [undo, setUndo] = useState<Task | null>(null)
  const undoTimer = useRef<number>()
  const reminders = useReminders(tasks)
  const [settings, updateSettings] = useSettings()
  const [collapsedMap, setCollapsed] = useCollapsed()
  const [showSettings, setShowSettings] = useState(false)

  const active = pages.find(p => p.id === activeId) ?? pages[0] ?? null
  useEffect(() => {
    if (active) try { localStorage.setItem('nudge-active', active.id) } catch { /* ignore */ }
  }, [active?.id])

  const color = COLORS[active?.color ?? 'violet'] ?? COLORS.violet
  const pageSections = sections.filter(s => s.page_id === active?.id)

  const deleteTask = (t: Task) => {
    data.deleteTask(t.id)
    setUndo(t)
    window.clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => setUndo(null), 5000)
  }

  return (
    <div
      className={`app layout-${settings.layout} density-${settings.density}`}
      style={{ ['--c' as string]: color.hex, ['--soft' as string]: color.soft }}
    >
      <header className="topbar">
        <div className="brand">
          <img src={import.meta.env.BASE_URL + 'favicon.svg'} alt="" />
          <span>Nudge</span>
        </div>
        <div className="top-actions">
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
              <button onClick={() => { data.updateTask(t.id, { done: true }); reminders.dismiss(t.id) }}>בוצע</button>
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
                onToggle={t => data.updateTask(t.id, { done: !t.done })}
                onEditTask={(t, title) => data.updateTask(t.id, { title })}
                onDeleteTask={deleteTask}
                onRemind={setRemindTask}
              />
              )
            })}
            </div>
            <AddInline className="new-section" placeholder="כותרת חדשה (נושא / קורס)…" onAdd={title => data.addSection(active.id, title)} />
          </>
        )}
      </main>

      {showSettings && (
        <SettingsDialog settings={settings} onChange={updateSettings} onClose={() => setShowSettings(false)} />
      )}

      {remindTask && (
        <ReminderPicker
          task={tasks.find(t => t.id === remindTask.id) ?? remindTask}
          onSave={iso => data.updateTask(remindTask.id, { remind_at: iso })}
          onClose={() => setRemindTask(null)}
        />
      )}

      {undo && (
        <div className="toast">
          המשימה נמחקה
          <button onClick={() => { data.restoreTask(undo); setUndo(null) }}>↩ בטל</button>
        </div>
      )}
    </div>
  )
}
