import { useState } from 'react'

type Props = { placeholder: string; onAdd: (text: string) => void; className?: string }

// Single-line "add" box. Enter adds and keeps focus for rapid entry.
export default function AddInline({ placeholder, onAdd, className }: Props) {
  const [value, setValue] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = value.trim()
    if (!v) return
    onAdd(v)
    setValue('')
  }
  return (
    <form className={'add-inline ' + (className ?? '')} onSubmit={submit}>
      <span className="plus" aria-hidden>+</span>
      <input value={value} onChange={e => setValue(e.target.value)} placeholder={placeholder} enterKeyHint="done" />
    </form>
  )
}
