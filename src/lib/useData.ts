import { useCallback, useEffect, useRef, useState } from 'react'
import { configured, supabase } from './supabase'
import type { Page, Section, Task } from '../types'

const byPos = <T extends { position: number }>(a: T, b: T) => a.position - b.position
const maxPos = (xs: { position: number }[]) => xs.reduce((m, x) => Math.max(m, x.position), 0) + 1

const LOCAL_KEY = 'nudge-local-data'
type Snapshot = { pages: Page[]; sections: Section[]; tasks: Task[] }

// Demo data for local mode (no Supabase configured) so the UI can be tried right away.
function seed(): Snapshot {
  const id = () => crypto.randomUUID()
  const uni = id(), personal = id(), work = id()
  const s1 = id(), s2 = id(), s3 = id(), s4 = id()
  const t = (section_id: string, title: string, position: number, done = false): Task =>
    ({ id: id(), section_id, title, done, remind_at: null, position })
  return {
    pages: [
      { id: uni, name: 'אוניברסיטה', color: 'violet', position: 1 },
      { id: personal, name: 'אישי', color: 'pink', position: 2 },
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

const loadLocal = (): Snapshot => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return seed()
}

// All app data + optimistic CRUD + realtime sync with Supabase.
export function useData(userId: string) {
  const initial = configured ? null : loadLocal()
  const [pages, setPages] = useState<Page[]>(initial?.pages ?? [])
  const [sections, setSections] = useState<Section[]>(initial?.sections ?? [])
  const [tasks, setTasks] = useState<Task[]>(initial?.tasks ?? [])
  const [loading, setLoading] = useState(configured)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(0) // in-flight writes; skip realtime refetch races

  // local mode: persist to localStorage
  useEffect(() => {
    if (configured) return
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ pages, sections, tasks })) } catch { /* ignore */ }
  }, [pages, sections, tasks])

  const load = useCallback(async () => {
    if (!configured) return
    const [p, s, t] = await Promise.all([
      supabase.from('pages').select('id,name,color,position').order('position'),
      supabase.from('sections').select('id,page_id,title,position').order('position'),
      supabase.from('tasks').select('id,section_id,title,done,remind_at,position').order('position'),
    ])
    const err = p.error || s.error || t.error
    if (err) { setError(err.message); setLoading(false); return }
    setError(null)
    setPages(p.data as Page[])
    setSections(s.data as Section[])
    setTasks(t.data as Task[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!configured) return
    load()
    let timer: number | undefined
    const refresh = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => { if (pending.current === 0) load() }, 250)
    }
    const channel = supabase
      .channel('nudge-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pages' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sections' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, refresh)
      .subscribe()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [load])

  // Run a write; on failure surface the error and resync from the server.
  const write = useCallback(async (op: () => PromiseLike<{ error: { message: string } | null }>) => {
    if (!configured) return
    pending.current++
    try {
      const { error } = await op()
      if (error) { setError(error.message); await load() }
    } finally {
      pending.current--
    }
  }, [load])

  const addPage = (name: string, color: string) => {
    const page: Page = { id: crypto.randomUUID(), name, color, position: maxPos(pages) }
    setPages(ps => [...ps, page])
    write(() => supabase.from('pages').insert({ ...page, user_id: userId }))
    return page
  }
  const updatePage = (id: string, patch: Partial<Pick<Page, 'name' | 'color'>>) => {
    setPages(ps => ps.map(p => (p.id === id ? { ...p, ...patch } : p)))
    write(() => supabase.from('pages').update(patch).eq('id', id))
  }
  const deletePage = (id: string) => {
    const secIds = sections.filter(s => s.page_id === id).map(s => s.id)
    setPages(ps => ps.filter(p => p.id !== id))
    setSections(ss => ss.filter(s => s.page_id !== id))
    setTasks(ts => ts.filter(t => !secIds.includes(t.section_id)))
    write(() => supabase.from('pages').delete().eq('id', id))
  }

  const addSection = (pageId: string, title: string) => {
    const section: Section = {
      id: crypto.randomUUID(), page_id: pageId, title,
      position: maxPos(sections.filter(s => s.page_id === pageId)),
    }
    setSections(ss => [...ss, section])
    write(() => supabase.from('sections').insert({ ...section, user_id: userId }))
  }
  const updateSection = (id: string, title: string) => {
    setSections(ss => ss.map(s => (s.id === id ? { ...s, title } : s)))
    write(() => supabase.from('sections').update({ title }).eq('id', id))
  }
  const deleteSection = (id: string) => {
    setSections(ss => ss.filter(s => s.id !== id))
    setTasks(ts => ts.filter(t => t.section_id !== id))
    write(() => supabase.from('sections').delete().eq('id', id))
  }

  const addTask = (sectionId: string, title: string) => {
    const task: Task = {
      id: crypto.randomUUID(), section_id: sectionId, title, done: false, remind_at: null,
      position: maxPos(tasks.filter(t => t.section_id === sectionId)),
    }
    setTasks(ts => [...ts, task])
    write(() => supabase.from('tasks').insert({ ...task, user_id: userId }))
  }
  const updateTask = (id: string, patch: Partial<Pick<Task, 'title' | 'done' | 'remind_at'>>) => {
    setTasks(ts => ts.map(t => (t.id === id ? { ...t, ...patch } : t)))
    write(() => supabase.from('tasks').update(patch).eq('id', id))
  }
  const deleteTask = (id: string) => {
    setTasks(ts => ts.filter(t => t.id !== id))
    write(() => supabase.from('tasks').delete().eq('id', id))
  }
  const restoreTask = (task: Task) => {
    setTasks(ts => [...ts, task])
    write(() => supabase.from('tasks').insert({ ...task, user_id: userId }))
  }

  return {
    pages: [...pages].sort(byPos),
    sections: [...sections].sort(byPos),
    tasks: [...tasks].sort(byPos),
    loading, error, clearError: () => setError(null),
    addPage, updatePage, deletePage,
    addSection, updateSection, deleteSection,
    addTask, updateTask, deleteTask, restoreTask,
  }
}
