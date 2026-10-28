import { useState } from 'react'
import type { Task } from '../types'

type Props = { task: Task; onSnooze: (iso: string) => void; onClose: () => void }

const pad = (n: number) => String(n).padStart(2, '0')
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const inMinutes = (m: number) => new Date(Date.now() + m * 60_000)
const evening = () => { const d = new Date(); d.setHours(19, 0, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1); return d }
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d }

// "Remind me again…" – quick presets or a custom time.
export default function SnoozeDialog({ task, onSnooze, onClose }: Props) {
  const [custom, setCustom] = useState(toLocalInput(inMinutes(60)))
  const pick = (d: Date) => { onSnooze(d.toISOString()); onClose() }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>לדחות את התזכורת</h3>
        <p className="muted small">{task.title}</p>
        <div className="quick">
          <button onClick={() => pick(inMinutes(10))}>10 דקות</button>
          <button onClick={() => pick(inMinutes(30))}>חצי שעה</button>
          <button onClick={() => pick(inMinutes(60))}>שעה</button>
          <button onClick={() => pick(inMinutes(180))}>3 שעות</button>
          <button onClick={() => pick(evening())}>הערב 19:00</button>
          <button onClick={() => pick(tomorrow())}>מחר 09:00</button>
        </div>
        <input type="datetime-local" value={custom} onChange={e => setCustom(e.target.value)} dir="ltr" />
        <div className="dialog-actions">
          <button className="primary" disabled={!custom} onClick={() => pick(new Date(custom))}>דחה למועד שבחרתי</button>
          <button className="ghost" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  )
}
