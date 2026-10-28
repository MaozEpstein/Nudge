import { useEffect, useState } from 'react'
import type { Settings } from '../lib/settings'
import { disablePush, enablePush, isPushEnabled, pushConfigured, pushSupported } from '../lib/push'

type Props = { settings: Settings; userId: string; onChange: (patch: Partial<Settings>) => void; onClose: () => void }

function Choice<T extends string>({ value, options, onPick }: {
  value: T
  options: { id: T; label: string; hint: string }[]
  onPick: (v: T) => void
}) {
  return (
    <div className="choices">
      {options.map(o => (
        <button key={o.id} className={'choice' + (o.id === value ? ' on' : '')} onClick={() => onPick(o.id)}>
          <b>{o.label}</b>
          <span>{o.hint}</span>
        </button>
      ))}
    </div>
  )
}

function PushSetting({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { isPushEnabled().then(setEnabled) }, [])

  const toggle = async () => {
    setBusy(true); setMsg('')
    try {
      if (enabled) await disablePush(); else await enablePush(userId)
      setEnabled(!enabled)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  if (!pushSupported()) return <p className="muted small">הדפדפן הזה לא תומך בהתראות כשהאפליקציה סגורה. ב-iPhone יש להתקין תחילה למסך הבית.</p>
  if (!pushConfigured()) return <p className="muted small">דורש הקמה חד-פעמית של השרת – ראה README (״התראות כשהאפליקציה סגורה״).</p>

  return (
    <>
      <button className={'switch' + (enabled ? ' on' : '')} onClick={toggle} disabled={busy} role="switch" aria-checked={enabled}>
        <span className="knob" />
        <span>{enabled ? 'פעיל במכשיר הזה' : 'כבוי במכשיר הזה'}</span>
      </button>
      {msg && <p className="error small">{msg}</p>}
    </>
  )
}

export default function SettingsDialog({ settings, userId, onChange, onClose }: Props) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>הגדרות</h3>

        <div className="setting">
          <label>פריסת הכותרות</label>
          <Choice
            value={settings.layout}
            onPick={layout => onChange({ layout })}
            options={[
              { id: 'columns', label: 'לרוחב', hint: 'כמה עמודות זו לצד זו' },
              { id: 'single', label: 'לאורך', hint: 'עמודה אחת' },
            ]}
          />
          <p className="muted small">בטלפון תמיד תוצג עמודה אחת, כי המסך צר.</p>
        </div>

        <div className="setting">
          <label>צפיפות</label>
          <Choice
            value={settings.density}
            onPick={density => onChange({ density })}
            options={[
              { id: 'compact', label: 'צפופה', hint: 'יותר משימות במסך' },
              { id: 'comfortable', label: 'רגועה', hint: 'יותר אוויר' },
            ]}
          />
        </div>

        {userId !== 'local' && (
          <div className="setting">
            <label>התראות כשהאפליקציה סגורה</label>
            <PushSetting userId={userId} />
          </div>
        )}

        <div className="dialog-actions">
          <button className="primary" onClick={onClose}>סגור</button>
        </div>
      </div>
    </div>
  )
}
