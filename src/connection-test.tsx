'use client'

import { useState } from 'react'

export function ConnectionTest() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ message: string; ok: boolean } | null>(null)

  async function test() {
    setBusy(true)
    setResult(null)
    try {
      const response = await fetch('/api/globals/equiviq-guides-settings/test-connection', { method: 'POST', credentials: 'same-origin' })
      const body = await response.json() as { message?: string }
      setResult({ ok: response.ok, message: body.message || 'The connection test did not complete.' })
    } catch { setResult({ ok: false, message: 'The connection test could not be completed.' }) }
    finally { setBusy(false) }
  }

  return <div style={{ marginBlock: '1.5rem', padding: '1.25rem', border: '1px solid var(--theme-elevation-150)', borderRadius: 12 }}>
    <strong>Connection status</strong>
    <p style={{ marginBlock: '.5rem 1rem' }}>Test the saved connection, or the existing server-secret connection if these fields are empty.</p>
    <button type="button" className="btn btn--style-primary" disabled={busy} onClick={test}>{busy ? 'Checking connection…' : 'Test connection'}</button>
    {result && <p role="status" style={{ marginTop: '1rem', color: result.ok ? 'var(--theme-success-700)' : 'var(--theme-error-700)' }}>{result.message}</p>}
  </div>
}
