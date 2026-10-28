import { useState } from 'react'
import { REPEAT_LABELS, type Repeat, type Task } from '../types'
import { ensureNotificationPermission } from '../lib/reminders'

type Props = { task: Task; onSave: (iso: string | null, repeat: Repeat | null) => void; onClose: () => void }

const pad = (n: number) => String(n).padStart(2, '0')
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

export default function ReminderPicker({ task, onSave, onClose }: Props) {
  const initial = task.remind_at ? new Date(task.remind_at) : new Date(Date.now() + 3600_000)
  const [value, setValue] = useState(toLocalInput(initial))
  const [repeat, setRepeat] = useState<Repeat | null>(task.repeat)
  const [perm, setPerm] = useState<string>('')

  const quick = (d: Date) => setValue(toLocalInput(d))
  const inHour = () => quick(new Date(Date.now() + 3600_000))
  const evening = () => { const d = new Date(); d.setHours(19, 0, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); quick(d) }
  const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); quick(d) }

  const save = async () => {
    const p = await ensureNotificationPermission()
    onSave(new Date(value).toISOString(), repeat)
    if (p === 'denied' || p === 'unsupported') {
      setPerm('ההתראות חסומות בדפדפן – התזכורת תופיע בתוך האפליקציה בלבד.')
      window.setTimeout(onClose, 1800)
      return
    }
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
        <div className="setting">
          <label>🔁 חזרה</label>
          <div className="quick">
            <button className={repeat === null ? 'on' : ''} onClick={() => setRepeat(null)}>ללא</button>
            {(Object.keys(REPEAT_LABELS) as Repeat[]).map(r => (
              <button key={r} className={repeat === r ? 'on' : ''} onClick={() => setRepeat(r)}>{REPEAT_LABELS[r]}</button>
            ))}
          </div>
          {repeat && <p className="muted small">כשתסמן את המשימה כבוצעה, היא תחזור אוטומטית למועד הבא.</p>}
        </div>
        {perm && <p className="notice small">{perm}</p>}
        <div className="dialog-actions">
          <button className="primary" onClick={save} disabled={!value}>שמור</button>
          {task.remind_at && <button className="ghost danger" onClick={() => { onSave(null, null); onClose() }}>הסר תזכורת</button>}
          <button className="ghost" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  )
}
