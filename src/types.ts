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

export type Repeat = 'daily' | 'weekly' | 'monthly'

export type Task = {
  id: string
  section_id: string
  title: string
  done: boolean
  remind_at: string | null
  repeat: Repeat | null
  position: number
}

export const REPEAT_LABELS: Record<Repeat, string> = {
  daily: 'כל יום',
  weekly: 'כל שבוע',
  monthly: 'כל חודש',
}

// Muted, layered hues. hex = accent, soft = light tint, ink = darker readable text tone.
export const COLORS: Record<string, { name: string; hex: string; soft: string; ink: string }> = {
  violet: { name: 'שזיף', hex: '#8a4f7d', soft: '#f3e6ef', ink: '#6b3560' },
  blue: { name: 'כחול אבק', hex: '#4a6a9c', soft: '#e4ebf5', ink: '#2f4a78' },
  teal: { name: 'ירוק ים', hex: '#2a8078', soft: '#dff0ed', ink: '#1d5f5a' },
  green: { name: 'מרווה', hex: '#6f8f4e', soft: '#ecf0df', ink: '#4d6a33' },
  gold: { name: 'חרדל', hex: '#c99a2e', soft: '#f6ecd0', ink: '#8f6a14' },
  orange: { name: 'טרקוטה', hex: '#cf6a3f', soft: '#f9e6dc', ink: '#a3482a' },
  pink: { name: 'ורוד אבק', hex: '#c4577a', soft: '#f8e3ea', ink: '#9a3558' },
}
