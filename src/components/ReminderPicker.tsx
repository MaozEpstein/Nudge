import { useState } from 'react'
import type { Task } from '../types'
import { ensureNotificationPermission } from '../lib/reminders'

type Props = { task: Task; onSave: (iso: string | null) => void; onClose: () => void }

const pad = (n: number) => String(n).padStart(2, '0')
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

export default function ReminderPicker({ task, onSave, onClose }: Props) {
  const initial = task.remind_at ? new Date(task.remind_at) : new Date(Date.now() + 3600_000)
  const [value, setValue] = useState(toLocalInput(initial))
  const [perm, setPerm] = useState<string>('')

  const quick = (d: Date) => setValue(toLocalInput(d))
  const inHour = () => quick(new Date(Date.now() + 3600_000))
  const evening = () => { const d = new Date(); d.setHours(19, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); quick(d) }
  const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); quick(d) }

  const save = async () => {
    const p = await ensureNotificationPermission()
    if (p === 'denied' || p === 'unsupported') {
      setPerm('ההתראות חסומות בדפדפן – התזכורת תופיע בתוך האפליקציה בלבד.')
      onSave(new Date(value).toISOString())
      window.setTimeout(onClose, 1800)
      return
    }
    onSave(new Date(value).toISOString())
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>תזכורת</h3>
        <p className="muted small">{task.title}</p>
        <div className="quick">
          <button onClick={inHour}>בעוד שעה</button>
          <button onClick={evening}>הערב 19:00</button>
          <button onClick={tomorrow}>מחר 09:00</button>
        </div>
        <input type="datetime-local" value={value} onChange={e => setValue(e.target.value)} dir="ltr" />
        {perm && <p className="notice small">{perm}</p>}
        <div className="dialog-actions">
          <button className="primary" onClick={save} disabled={!value}>שמור</button>
          {task.remind_at && <button className="ghost danger" onClick={() => { onSave(null); onClose() }}>הסר תזכורת</button>}
          <button className="ghost" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  )
}
