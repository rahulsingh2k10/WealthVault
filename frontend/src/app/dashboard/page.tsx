import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { getSession } from '@/lib/session'
import { getUpgradePromptData } from '@/lib/services/UpgradePromptService'
import { UpgradePrompt } from '@/components/dashboard/UpgradePrompt'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session.encryptionKey) redirect('/unlock')

  const prompt = await getUpgradePromptData(session.userId)

  return (
    <AppShell title="Dashboard">
      {prompt && <UpgradePrompt plans={prompt.plans} memberCount={prompt.memberCount} />}
    </AppShell>
  )
}
