import { getSession } from '@/lib/session'
import { getUpgradePromptData, listAllPlanCards } from '@/lib/services/UpgradePromptService'
import { buildManageView, listPaidPlansForChange } from '@/lib/services/SubscriptionService'
import { ManageSubscription } from '@/components/subscription/ManageSubscription'
import { FreeTierUpgradePanel } from '@/components/subscription/FreeTierUpgradePanel'

export default async function SubscriptionPage() {
  const session = await getSession()

  const [view, prompt, planCards] = await Promise.all([
    buildManageView(session.userId),
    getUpgradePromptData(session.userId),
    listAllPlanCards(),
  ])

  return (
    <>
      {view.tier === 'FREE' ? (
        prompt ? (
          <FreeTierUpgradePanel plans={prompt.plans} memberCount={prompt.memberCount} />
        ) : (
          <p className="text-sm text-[color:var(--ui-text-muted)]">
            We couldn&apos;t load upgrade plans right now. Please refresh the page.
          </p>
        )
      ) : (
        <ManageSubscription view={view} paidPlans={await listPaidPlansForChange()} planCards={planCards} />
      )}
    </>
  )
}
