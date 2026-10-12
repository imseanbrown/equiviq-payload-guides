'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max'

type CTA = {
  slug: string
  heading: string
  ctaText?: string | null
  privacyUrl?: string | null
  successMessage?: string | null
  errorMessage?: string | null
  fields?: Record<string, { visible?: boolean | null; required?: boolean | null; label?: string | null; countryLabel?: string | null } | null> | null
}

const labels: Record<string, string> = { given_name: 'Given name', surname: 'Surname', email: 'Email', organization: 'Organization', phone: 'Phone' }
const countryNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null
const countries = getCountries().map((code) => ({ code, label: `${code} +${getCountryCallingCode(code)}`, name: countryNames?.of(code) || code }))
  .sort((left, right) => left.name.localeCompare(right.name))

export function EquiviqLeadForm({ cta, privacyPolicyUrl }: { cta: CTA; privacyPolicyUrl?: string }) {
  const [started, setStarted] = useState(0)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const privacy = cta.privacyUrl || privacyPolicyUrl
  useEffect(() => { setStarted(Date.now()) }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending || !started) return
    setSending(true); setMessage('')
    const form = event.currentTarget
    const fields = Object.fromEntries(new FormData(form).entries())
    if (typeof fields.phone === 'string' && fields.phone.trim()) {
      const parsed = parsePhoneNumberFromString(fields.phone, String(fields.phone_country || 'US') as CountryCode)
      if (!parsed?.isValid()) { setMessage('Enter a valid international phone number.'); setSending(false); return }
      fields.phone_e164 = parsed.number
    }
    try {
      const reply = await fetch('/api/equiviq-lead-ctas/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, cta_id: cta.slug, started, source_url: window.location.href.split('#')[0] }),
      })
      const result = await reply.json() as { message?: string }
      setMessage(result.message || (reply.ok ? 'Thank you.' : (cta.errorMessage || 'Please try again.')))
      if (reply.ok) { setSent(true); form.reset() }
    } catch { setMessage(cta.errorMessage || 'The form could not be sent. Please try again.') }
    finally { setSending(false) }
  }

  if (!privacy) return <p>Lead form unavailable: configure a privacy policy URL.</p>
  if (sent) return <section className="equiviq-lead-form" role="status"><h2>{cta.heading}</h2><p>{message}</p></section>
  const field = (name: string) => {
    if (name !== 'email' && !cta.fields?.[name]?.visible) return null
    const label = cta.fields?.[name]?.label?.trim() || labels[name]
    const required = name === 'email' || name === 'organization' || Boolean(cta.fields?.[name]?.required)
    return <div key={name} className={`equiviq-lead-field equiviq-lead-field-${name}`}>
      {name === 'phone' && <select name="phone_country" defaultValue="US" aria-label={cta.fields?.phone?.countryLabel?.trim() || 'Country code'} title={cta.fields?.phone?.countryLabel?.trim() || 'Country code'}>{countries.map(({ code, label, name }) => <option key={code} value={code} title={name}>{label}</option>)}</select>}
      <input id={`${cta.slug}-${name}`} name={name} type={name === 'email' ? 'email' : name === 'phone' ? 'tel' : 'text'} placeholder={label} aria-label={label} autoComplete={{ given_name: 'given-name', surname: 'family-name', email: 'email', organization: 'organization', phone: 'tel' }[name]} required={required} maxLength={name === 'organization' ? 240 : name === 'email' ? 254 : 120} />
    </div>
  }
  return <form className="equiviq-lead-form" onSubmit={submit}>
    <h2>{cta.heading}</h2>
    {cta.ctaText && <p className="equiviq-lead-cta-text" style={{ whiteSpace: 'pre-line' }}>{cta.ctaText}</p>}
    <div aria-hidden="true" className="equiviq-lead-honeypot"><label>Leave blank<input name="website" autoComplete="off" tabIndex={-1} /></label></div>
    {(cta.fields?.given_name?.visible || cta.fields?.surname?.visible) && <div className="equiviq-lead-name-row">{field('given_name')}{field('surname')}</div>}
    {field('email')}{field('organization')}{field('phone')}
    {privacy && <p>By submitting, you opt in to contact. <a href={privacy} target="_blank" rel="noopener noreferrer">Privacy policy and opt-out</a></p>}
    <button type="submit" disabled={sending}>{sending ? 'Sending…' : 'Submit'}</button>
    <p aria-live="polite" role="status">{message}</p>
  </form>
}
