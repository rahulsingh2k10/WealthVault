import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { AppShell } from '@/components/layout/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session.encryptionKey || !session.userId) redirect('/unlock')

  return <AppShell>{children}</AppShell>
}
