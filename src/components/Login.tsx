import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('sending')
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    if (error) { setError(error.message); setState('idle') } else setState('sent')
  }

  return (
    <div className="center-screen">
      <div className="login-card">
        <img src={import.meta.env.BASE_URL + 'favicon.svg'} alt="" className="logo" />
        <h1>Nudge</h1>
        <p className="muted">המשימות שלך, פשוט ובצבע</p>
        {state === 'sent' ? (
          <p className="notice">שלחנו קישור כניסה אל <b>{email}</b>.<br />פתח אותו מהמכשיר הזה ותהיה בפנים ✨</p>
        ) : (
          <form onSubmit={submit}>
            <input
              type="email" required dir="ltr" placeholder="האימייל שלך"
              value={email} onChange={e => setEmail(e.target.value)} autoFocus
            />
            <button className="primary" disabled={state === 'sending'}>
              {state === 'sending' ? 'שולח…' : 'שלח לי קישור כניסה'}
            </button>
            {error && <p className="error">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
