'use client'

import { useEffect } from 'react'

export function GuideViewTracker({ slug }: { slug: string }): null {
  useEffect(() => {
    if (document.visibilityState !== 'visible') return
    const eventID = crypto.randomUUID()
    void fetch('/api/guide-views', {
      method: 'POST', credentials: 'same-origin', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, event_id: eventID, page_url: window.location.origin + window.location.pathname }),
    }).catch((): void => undefined)
  }, [slug])
  return null
}
