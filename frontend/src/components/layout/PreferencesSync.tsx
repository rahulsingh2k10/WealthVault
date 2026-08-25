'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useLocale } from '@/context/LocaleContext'
import { useColorTheme, COLOR_THEMES, type ColorTheme } from '@/context/ColorThemeContext'
import type { Locale } from '@/i18n/translations'

function isColorTheme(value: string): value is ColorTheme {
  return (COLOR_THEMES as readonly string[]).includes(value)
}

export function PreferencesSync() {
  const { setLocale, setCountry } = useLocale()
  const { setTheme } = useTheme()
  const { setColorTheme } = useColorTheme()

  useEffect(() => {
    fetch('/api/preferences')
      .then((r) => (r.ok ? r.json() : null))
      .then((prefs) => {
        if (!prefs) return
        if (prefs.locale)  setLocale(prefs.locale as Locale)
        if (prefs.country) setCountry(prefs.country)
        if (prefs.theme)   setTheme(prefs.theme)
        if (prefs.colorTheme && isColorTheme(prefs.colorTheme)) setColorTheme(prefs.colorTheme)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
