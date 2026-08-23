export async function savePreference(key: string, value: string): Promise<void> {
  await fetch('/api/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  }).catch(() => {})
}
