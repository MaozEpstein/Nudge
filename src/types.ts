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

// Calm, slightly muted hues. hex = accent, soft = light tint, ink = darker readable text tone.
export const COLORS: Record<string, { name: string; hex: string; soft: string; ink: string }> = {
  violet: { name: 'אינדיגו', hex: '#5f65b0', soft: '#eceefa', ink: '#3f4585' },
  blue: { name: 'תכלת', hex: '#3b82b6', soft: '#e5f1f8', ink: '#24618f' },
  teal: { name: 'ירוק ים', hex: '#2a8a7e', soft: '#e0f2ef', ink: '#1b665d' },
  green: { name: 'מרווה', hex: '#5f9150', soft: '#e9f1e5', ink: '#3f6b33' },
  gold: { name: 'חרדל', hex: '#c28f1f', soft: '#f8efd5', ink: '#85600a' },
  orange: { name: 'אלמוג', hex: '#d9714b', soft: '#fbe9e1', ink: '#a34a28' },
  pink: { name: 'ורדרד', hex: '#c95b82', soft: '#f9e5ec', ink: '#9a3a5e' },
}
