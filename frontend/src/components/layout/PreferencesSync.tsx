'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useLocale } from '@/context/LocaleContext'
import type { Locale } from '@/i18n/translations'

export function PreferencesSync() {
  const { setLocale, setCountry } = useLocale()
  const { setTheme } = useTheme()

  useEffect(() => {
    fetch('/api/preferences')
      .then((r) => (r.ok ? r.json() : null))
      .then((prefs) => {
        if (!prefs) return
        if (prefs.locale)  setLocale(prefs.locale as Locale)
        if (prefs.country) setCountry(prefs.country)
        if (prefs.theme)   setTheme(prefs.theme)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
