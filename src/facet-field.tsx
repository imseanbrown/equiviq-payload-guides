'use client'

import { useEffect, useId, useState } from 'react'
import { useField } from '@payloadcms/ui'
import type { GuideFacets } from './server'

type Kind = 'folder' | 'category' | 'tag' | 'company'
const names: Record<Kind, keyof GuideFacets> = { folder: 'folders', category: 'categories', tag: 'tags', company: 'companies' }
let facetsPromise: Promise<GuideFacets | null> | null = null
function loadFacets(): Promise<GuideFacets | null> {
  if (!facetsPromise) facetsPromise = fetch('/api/guide-facets', { credentials: 'same-origin' })
    .then((response) => response.ok ? response.json() as Promise<GuideFacets> : null)
    .catch((): null => null)
  return facetsPromise
}

export function FacetField({ path, kind, mode }: { path: string; kind: Kind; mode: 'Include' | 'Exclude' }) {
  const { value, setValue } = useField<string>({ path })
  const [facets, setFacets] = useState<GuideFacets | null>(null)
  const [search, setSearch] = useState('')
  const id = useId()
  useEffect(() => {
    let mounted = true
    void loadFacets().then((data) => { if (mounted) setFacets(data) })
    return () => { mounted = false }
  }, [])
  let selected: string[] = []
  try { const parsed: unknown = JSON.parse(value || '[]'); if (Array.isArray(parsed)) selected = parsed.filter((item): item is string => typeof item === 'string') }
  catch { selected = (value || '').split(',').map((item) => item.trim()).filter(Boolean) }
  const options = facets?.[names[kind]] || []
  if (kind === 'company' && facets && options.length <= 1 && selected.length === 0) return null
  function toggle(item: string) { setValue(JSON.stringify(selected.includes(item) ? selected.filter((name) => name !== item) : [...selected, item])) }
  return <div className="equiviq-facet-field" style={{ marginBlock: '1rem' }}>
    <label htmlFor={id} className="field-label" style={{ display: 'block', marginBottom: '.35rem' }}>{mode} {names[kind]}</label>
    <p className="field-description">{mode === 'Include' ? 'Leave empty to show all.' : 'Excluded items take priority.'}</p>
    {selected.length > 0 && <div aria-label={`Selected ${names[kind]}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginBlock: '.6rem' }}>
      {selected.map((item) => <button key={item} type="button" onClick={() => toggle(item)} aria-label={`Remove ${item}`} style={{ border: '1px solid currentColor', borderRadius: 999, padding: '.25rem .65rem', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>{item} ×</button>)}
    </div>}
    <input id={id} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Find ${names[kind]}`} style={{ width: '100%', padding: '.65rem' }} />
    <div role="group" aria-label={`${mode} ${names[kind]}`} style={{ maxHeight: 180, overflowY: 'auto', marginTop: '.5rem' }}>
      {facets ? options.filter((item) => item.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((item) => <label key={item} style={{ display: 'flex', gap: '.65rem', alignItems: 'center', padding: '.35rem .25rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={selected.includes(item)} onChange={() => toggle(item)} style={{ width: 16, height: 16, flex: '0 0 16px', margin: 0, accentColor: 'var(--theme-elevation-900)' }} /><span>{item}</span>
      </label>) : <p>Choices are temporarily unavailable. Saved selections remain in place.</p>}
    </div>
  </div>
}
