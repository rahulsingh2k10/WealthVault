import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { getSession } from '@/lib/session'
import { getUpgradePromptData } from '@/lib/services/UpgradePromptService'
import { buildManageView, listPaidPlansForChange } from '@/lib/services/SubscriptionService'
import { ManageSubscription } from '@/components/subscription/ManageSubscription'
import { OpenUpgradeModalButton } from '@/components/subscription/OpenUpgradeModalButton'

export default async function SubscriptionPage() {
  const session = await getSession()
  if (!session.encryptionKey || !session.userId) redirect('/unlock')

  const [view, prompt] = await Promise.all([
    buildManageView(session.userId),
    getUpgradePromptData(session.userId),
  ])

  return (
    <AppShell title="Manage Subscription">
      {view.tier === 'FREE' ? (
        <div>
          <h2 className="mb-4 text-lg font-bold text-[color:var(--ui-text-pri)]">
            You&apos;re on the Free plan
          </h2>
          {prompt ? (
            <OpenUpgradeModalButton plans={prompt.plans} memberCount={prompt.memberCount} />
          ) : (
            // Defensive fallback: getUpgradePromptData returns non-null exactly when the
            // user is FREE, so this shouldn't happen — but don't crash the page if it does.
            <p className="text-sm text-[color:var(--ui-text-muted)]">
              We couldn&apos;t load upgrade plans right now. Please refresh the page.
            </p>
          )}
        </div>
      ) : (
        <ManageSubscription view={view} paidPlans={await listPaidPlansForChange()} />
      )}
    </AppShell>
  )
}
