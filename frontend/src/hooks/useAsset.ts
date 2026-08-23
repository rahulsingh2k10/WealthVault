'use client'

import { useState, useEffect, useCallback } from 'react'

export function useAsset<T extends { id: number }>(path: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(path)
      if (!res.ok) throw new Error(res.statusText)
      const json = await res.json()
      setData(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => { fetchAll() }, [fetchAll])

  const create = useCallback(
    async (item: Omit<T, 'id' | 'createdAt' | 'updatedAt'>) => {
      await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })
      await fetchAll()
    },
    [path, fetchAll]
  )

  const update = useCallback(
    async (id: number, item: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>) => {
      await fetch(`${path}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })
      await fetchAll()
    },
    [path, fetchAll]
  )

  const remove = useCallback(
    async (id: number) => {
      await fetch(`${path}/${id}`, { method: 'DELETE' })
      await fetchAll()
    },
    [path, fetchAll]
  )

  return { data, loading, error, create, update, remove, refresh: fetchAll }
}
