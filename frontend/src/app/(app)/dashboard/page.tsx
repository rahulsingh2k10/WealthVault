import { getSession } from '@/lib/session'
import { getUpgradePromptData } from '@/lib/services/UpgradePromptService'
import { UpgradePrompt } from '@/components/dashboard/UpgradePrompt'

export default async function DashboardPage() {
  const session = await getSession()
  const prompt = await getUpgradePromptData(session.userId)

  return (
    <>
      {prompt && <UpgradePrompt plans={prompt.plans} memberCount={prompt.memberCount} />}
    </>
  )
}
