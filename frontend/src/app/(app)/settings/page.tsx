import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { getSession } from '@/lib/session'
import { SettingsPanel } from '@/components/settings/SettingsPanel'

export default async function SettingsPage() {
  const session = await getSession()
  if (!session.encryptionKey || !session.userId) redirect('/unlock')

  return (
    <AppShell title="Settings">
      <SettingsPanel />
    </AppShell>
  )
}
