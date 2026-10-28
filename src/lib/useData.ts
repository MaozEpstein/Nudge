import { useCallback, useEffect, useRef, useState } from 'react'
import { configured, supabase } from './supabase'
import type { Page, Section, Task } from '../types'

const byPos = <T extends { position: number }>(a: T, b: T) => a.position - b.position
const maxPos = (xs: { position: number }[]) => xs.reduce((m, x) => Math.max(m, x.position), 0) + 1

// Position that puts an item right before `beforeId` among `sibs` (sorted, without the item); null = at the end.
function positionBefore(sibs: { id: string; position: number }[], beforeId: string | null) {
  const i = beforeId ? sibs.findIndex(s => s.id === beforeId) : -1
  const idx = i < 0 ? sibs.length : i
  const prev = sibs[idx - 1]?.position
  const next = sibs[idx]?.position
  if (prev === undefined && next === undefined) return 1
  if (prev === undefined) return next! - 1
  if (next === undefined) return prev + 1
  return (prev + next) / 2
}

const LOCAL_KEY = 'nudge-local-data'
const cacheKey = (u: string) => `nudge-cache-${u}`
const outboxKey = (u: string) => `nudge-outbox-${u}`
type Snapshot = { pages: Page[]; sections: Section[]; tasks: Task[] }

const readJson = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback } catch { return fallback }
}
const writeJson = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

// Demo data for local mode (no Supabase configured) so the UI can be tried right away.
function seed(): Snapshot {
  const id = () => crypto.randomUUID()
  const uni = id(), personal = id(), work = id()
  const s1 = id(), s2 = id(), s3 = id(), s4 = id()
  const t = (section_id: string, title: string, position: number, done = false): Task =>
    ({ id: id(), section_id, title, done, remind_at: null, repeat: null, position })
  return {
    pages: [
      { id: uni, name: 'אוניברסיטה', color: 'violet', position: 1 },
      { id: personal, name: 'אישי', color: 'orange', position: 2 },
      { id: work, name: 'עבודה', color: 'teal', position: 3 },
    ],
    sections: [
      { id: s1, page_id: uni, title: 'חדשנות מכוונת עיצוב', position: 1 },
      { id: s2, page_id: uni, title: 'מעבדה', position: 2 },
      { id: s3, page_id: uni, title: 'עיבוד אותות מתקדם', position: 3 },
      { id: s4, page_id: personal, title: 'השבוע', position: 1 },
    ],
    tasks: [
      t(s1, 'מטלת סוף של שבוע 3', 1),
      t(s2, 'הכנה לבוחן של המעבדה הבאה', 1),
      t(s3, 'השלמת השיעור – לקרוא סיכום של אייל', 1),
      t(s3, 'השלמת תרגול', 2, true),
      t(s4, 'לקבוע תור לרופא שיניים', 1),
    ],
  }
}

// ---- offline write queue -------------------------------------------------
type Table = 'pages' | 'sections' | 'tasks'
type Op =
  | { kind: 'upsert'; table: Table; row: Record<string, unknown> }
  | { kind: 'update'; table: Table; id: string; patch: Record<string, unknown> }
  | { kind: 'delete'; table: Table; id: string }

const isNetworkError = (msg: string) => !navigator.onLine || /fetch|network|load failed/i.test(msg)

// All app data + optimistic CRUD, offline queue and realtime sync with Supabase.
export function useData(userId: string) {
  const [initial] = useState<Snapshot | null>(() =>
    configured ? readJson<Snapshot | null>(cacheKey(userId), null) : readJson<Snapshot | null>(LOCAL_KEY, null) ?? seed())
  const [pages, setPages] = useState<Page[]>(initial?.pages ?? [])
  const [sections, setSections] = useState<Section[]>(initial?.sections ?? [])
  const [tasks, setTasks] = useState<Task[]>(initial?.tasks ?? [])
  const [loading, setLoading] = useState(!initial)
  const [error, setError] = useState<string | null>(null)
  const outbox = useRef<Op[]>(configured ? readJson<Op[]>(outboxKey(userId), []) : [])
  const [unsynced, setUnsynced] = useState(outbox.current.length > 0)
  const flushing = useRef(false)

  // keep a local copy: offline cache (Supabase mode) or the data itself (local mode)
  useEffect(() => {
    if (loading) return
    writeJson(configured ? cacheKey(userId) : LOCAL_KEY, { pages, sections, tasks })
  }, [pages, sections, tasks, loading, userId])

  const exec = useCallback((op: Op) => {
    if (op.kind === 'upsert') return supabase.from(op.table).upsert({ ...op.row, user_id: userId })
    if (op.kind === 'update') return supabase.from(op.table).update(op.patch).eq('id', op.id)
    return supabase.from(op.table).delete().eq('id', op.id)
  }, [userId])

  // Send queued writes in order. Stops on network errors (kept for retry). Returns true if a resync is needed.
  const flush = useCallback(async (): Promise<boolean> => {
    if (!configured || flushing.current) return false
    flushing.current = true
    let resync = false
    try {
      while (outbox.current.length) {
        let err: string | null = null
        try { err = (await exec(outbox.current[0])).error?.message ?? null } catch (e) { err = String(e) }
        if (err) {
          if (isNetworkError(err)) break
          setError(err)
          resync = true
        }
        outbox.current.shift()
        writeJson(outboxKey(userId), outbox.current)
      }
    } finally {
      flushing.current = false
      setUnsynced(outbox.current.length > 0)
    }
    return resync
  }, [exec, userId])

  const load = useCallback(async () => {
    if (!configured) return
    if (outbox.current.length) { await flush(); if (outbox.current.length) return } // never overwrite unsent changes
    const [p, s, t] = await Promise.all([
      supabase.from('pages').select('id,name,color,position').order('position'),
      supabase.from('sections').select('id,page_id,title,position').order('position'),
      supabase.from('tasks').select('id,section_id,title,done,remind_at,repeat,position').order('position'),
    ])
    const err = p.error || s.error || t.error
    if (err) {
      if (!isNetworkError(err.message)) setError(err.message)
      setLoading(false)
      return
    }
    setError(null)
    setPages(p.data as Page[])
    setSections(s.data as Section[])
    setTasks(t.data as Task[])
    setLoading(false)
  }, [flush])

  useEffect(() => {
    if (!configured) return
    load()
    let timer: number | undefined
    const refresh = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => { if (!flushing.current && !outbox.current.length) load() }, 250)
    }
    const channel = supabase
      .channel('nudge-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pages' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sections' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, refresh)
      .subscribe()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    const onOnline = () => load()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      supabase.removeChannel(channel)
    }
  }, [load])

  const enqueue = useCallback((op: Op) => {
    if (!configured) return
    outbox.current.push(op)
    writeJson(outboxKey(userId), outbox.current)
    setUnsynced(true)
    flush().then(resync => { if (resync) load() })
  }, [flush, load, userId])

  // ---- pages
  const addPage = (name: string, color: string) => {
    const page: Page = { id: crypto.randomUUID(), name, color, position: maxPos(pages) }
    setPages(ps => [...ps, page])
    enqueue({ kind: 'upsert', table: 'pages', row: page })
    return page
  }
  const updatePage = (id: string, patch: Partial<Pick<Page, 'name' | 'color'>>) => {
    setPages(ps => ps.map(p => (p.id === id ? { ...p, ...patch } : p)))
    enqueue({ kind: 'update', table: 'pages', id, patch })
  }
  const deletePage = (id: string) => {
    const secIds = sections.filter(s => s.page_id === id).map(s => s.id)
    setPages(ps => ps.filter(p => p.id !== id))
    setSections(ss => ss.filter(s => s.page_id !== id))
    setTasks(ts => ts.filter(t => !secIds.includes(t.section_id)))
    enqueue({ kind: 'delete', table: 'pages', id })
  }
  const movePage = (id: string, beforeId: string | null) => {
    const position = positionBefore([...pages].sort(byPos).filter(p => p.id !== id), beforeId)
    setPages(ps => ps.map(p => (p.id === id ? { ...p, position } : p)))
    enqueue({ kind: 'update', table: 'pages', id, patch: { position } })
  }

  // ---- sections
  const addSection = (pageId: string, title: string) => {
    const section: Section = {
      id: crypto.randomUUID(), page_id: pageId, title,
      position: maxPos(sections.filter(s => s.page_id === pageId)),
    }
    setSections(ss => [...ss, section])
    enqueue({ kind: 'upsert', table: 'sections', row: section })
    return section
  }
  const updateSection = (id: string, title: string) => {
    setSections(ss => ss.map(s => (s.id === id ? { ...s, title } : s)))
    enqueue({ kind: 'update', table: 'sections', id, patch: { title } })
  }
  const deleteSection = (id: string) => {
    setSections(ss => ss.filter(s => s.id !== id))
    setTasks(ts => ts.filter(t => t.section_id !== id))
    enqueue({ kind: 'delete', table: 'sections', id })
  }
  const moveSection = (id: string, beforeId: string | null) => {
    const sec = sections.find(s => s.id === id)
    if (!sec) return
    const sibs = sections.filter(s => s.page_id === sec.page_id && s.id !== id).sort(byPos)
    const position = positionBefore(sibs, beforeId)
    setSections(ss => ss.map(s => (s.id === id ? { ...s, position } : s)))
    enqueue({ kind: 'update', table: 'sections', id, patch: { position } })
  }

  // ---- tasks
  const addTask = (sectionId: string, title: string) => {
    const task: Task = {
      id: crypto.randomUUID(), section_id: sectionId, title, done: false, remind_at: null, repeat: null,
      position: maxPos(tasks.filter(t => t.section_id === sectionId)),
    }
    setTasks(ts => [...ts, task])
    enqueue({ kind: 'upsert', table: 'tasks', row: task })
  }
  const updateTask = (id: string, patch: Partial<Pick<Task, 'title' | 'done' | 'remind_at' | 'repeat'>>) => {
    setTasks(ts => ts.map(t => (t.id === id ? { ...t, ...patch } : t)))
    // a changed reminder time must be re-armed for server-side push
    enqueue({ kind: 'update', table: 'tasks', id, patch: 'remind_at' in patch ? { ...patch, reminded_at: null } : patch })
  }
  const deleteTasks = (ids: string[]) => {
    const set = new Set(ids)
    setTasks(ts => ts.filter(t => !set.has(t.id)))
    ids.forEach(id => enqueue({ kind: 'delete', table: 'tasks', id }))
  }
  const deleteTask = (id: string) => deleteTasks([id])
  const restoreTasks = (restored: Task[]) => {
    setTasks(ts => [...ts, ...restored])
    restored.forEach(task => enqueue({ kind: 'upsert', table: 'tasks', row: task }))
  }
  // Move a task into `sectionId`, right before `beforeId` (null = end of its done/open group).
  const moveTask = (id: string, sectionId: string, beforeId: string | null) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const sibs = tasks.filter(t => t.section_id === sectionId && t.done === task.done && t.id !== id).sort(byPos)
    const position = positionBefore(sibs, beforeId)
    setTasks(ts => ts.map(t => (t.id === id ? { ...t, section_id: sectionId, position } : t)))
    enqueue({ kind: 'update', table: 'tasks', id, patch: { section_id: sectionId, position } })
  }

  return {
    pages: [...pages].sort(byPos),
    sections: [...sections].sort(byPos),
    tasks: [...tasks].sort(byPos),
    loading, error, unsynced, clearError: () => setError(null),
    addPage, updatePage, deletePage, movePage,
    addSection, updateSection, deleteSection, moveSection,
    addTask, updateTask, deleteTask, deleteTasks, restoreTasks, moveTask,
  }
}
