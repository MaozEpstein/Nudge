import type { Settings } from '../lib/settings'

type Props = { settings: Settings; onChange: (patch: Partial<Settings>) => void; onClose: () => void }

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

export default function SettingsDialog({ settings, onChange, onClose }: Props) {
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

        <div className="dialog-actions">
          <button className="primary" onClick={onClose}>סגור</button>
        </div>
      </div>
    </div>
  )
}
