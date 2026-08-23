'use client'

import { Info } from 'lucide-react'
import { useLocale } from '@/context/LocaleContext'
import { getCategoryInfo } from '@/i18n/categoryInfo'

interface CategoryBannerProps {
  slug: string
}

export function CategoryBanner({ slug }: CategoryBannerProps) {
  const { country } = useLocale()
  const info = getCategoryInfo(slug, country)

  if (!info) return null

  return (
    <div className="mb-6 flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3.5 dark:border-indigo-900/40 dark:bg-indigo-950/30">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400 dark:text-indigo-500" />
      <div className="min-w-0">
        <p className="text-sm leading-relaxed text-indigo-800 dark:text-indigo-200">{info.description}</p>
        {info.instruments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {info.instruments.map((instrument) => (
              <span
                key={instrument}
                className="rounded-full border border-indigo-200 bg-white px-2.5 py-0.5 text-xs text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300"
              >
                {instrument}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
