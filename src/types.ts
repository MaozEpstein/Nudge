export type Page = {
  id: string
  name: string
  color: string
  position: number
}

export type Section = {
  id: string
  page_id: string
  title: string
  position: number
}

export type Task = {
  id: string
  section_id: string
  title: string
  done: boolean
  remind_at: string | null
  position: number
}

export const COLORS: Record<string, { name: string; hex: string; soft: string }> = {
  violet: { name: 'סגול', hex: '#7c5cff', soft: '#efeaff' },
  blue: { name: 'כחול', hex: '#3b82f6', soft: '#e3eeff' },
  teal: { name: 'טורקיז', hex: '#14b8a6', soft: '#d9f6f2' },
  green: { name: 'ירוק', hex: '#22c55e', soft: '#dcf7e5' },
  orange: { name: 'כתום', hex: '#f59e0b', soft: '#fff0d4' },
  pink: { name: 'ורוד', hex: '#ec4899', soft: '#fde4f0' },
}
