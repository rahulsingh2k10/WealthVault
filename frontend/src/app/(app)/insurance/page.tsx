'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { CategoryBanner } from '@/components/ui/CategoryBanner'
import { DataTable, Column } from '@/components/ui/DataTable'
import { EditModal, Field, FieldGrid } from '@/components/ui/EditModal'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { formatChangeRatio, pnlClass } from '@/lib/utils'
import { useCurrency } from '@/context/CurrencyContext'
import { useAsset } from '@/hooks/useAsset'
import type { InsurancePolicy } from '@/lib/types'

export default function InsurancePage() {
  const { format } = useCurrency()
  const { data, loading, create, update, remove } = useAsset<InsurancePolicy>('/api/insurance')

  const [editRow, setEditRow] = useState<InsurancePolicy | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [annualPremium, setAnnualPremium] = useState('')
  const [purchaseVal, setPurchaseVal] = useState('')
  const [currentVal, setCurrentVal] = useState('')

  const purchaseAmount = parseFloat(purchaseVal) || 0
  const currentAmount  = parseFloat(currentVal) || 0

  const columns: Column<InsurancePolicy>[] = [
    { key: 'instrument',    label: 'Policy Name',  className: 'max-w-xs truncate' },
    { key: 'policyNumber',  label: 'Policy #',     className: 'font-mono text-xs' },
    { key: 'type',          label: 'Type' },
    { key: 'annualPremium', label: 'Annual Premium', render: (v) => format(Number(v)) },
    { key: 'purchaseAmount', label: 'Total Paid',  render: (v) => format(Number(v)) },
    { key: 'currentAmount', label: 'Current Value', render: (v) => format(Number(v)) },
    { key: 'pnl', label: 'P&L', render: (v) => <span className={pnlClass(Number(v))}>{Number(v) >= 0 ? '+' : ''}{format(Number(v))}</span> },
    { key: 'netChange', label: 'Return', render: (v) => <Badge variant={Number(v) >= 0 ? 'gain' : 'loss'}>{formatChangeRatio(Number(v))}</Badge> },
    { key: 'platform', label: 'Provider' },
  ]

  const totals = data.reduce((acc, h) => ({ invested: acc.invested + h.purchaseAmount, current: acc.current + h.currentAmount, pnl: acc.pnl + h.pnl }), { invested: 0, current: 0, pnl: 0 })

  const openAdd    = () => { setEditRow(null); setAnnualPremium(''); setPurchaseVal(''); setCurrentVal(''); setIsAdding(true) }
  const closeModal = () => { setEditRow(null); setIsAdding(false) }

  const handleEdit = (row: InsurancePolicy) => {
    setEditRow(row)
    setAnnualPremium(String(row.annualPremium))
    setPurchaseVal(String(row.purchaseAmount))
    setCurrentVal(String(row.currentAmount))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    const fields = {
      instrument:    fd.get('instrument') as string,
      policyNumber:  fd.get('policyNumber') as string,
      type:          fd.get('type') as string,
      annualPremium: parseFloat(annualPremium),
      purchaseAmount,
      currentAmount,
      pnl:           currentAmount - purchaseAmount,
      netChange:     purchaseAmount > 0 ? (currentAmount - purchaseAmount) / purchaseAmount : 0,
      platform:      fd.get('platform') as string,
    }
    if (editRow) { await update(editRow.id, fields) } else { await create(fields) }
    setSaving(false)
    closeModal()
  }

  return (
    <AppShell title="Insurance">
      <CategoryBanner slug="insurance" />
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Invested',      value: format(totals.invested) },
          { label: 'Current Value', value: format(totals.current) },
          { label: 'P&L', value: `${totals.pnl >= 0 ? '+' : ''}${format(totals.pnl)}`, cls: pnlClass(totals.pnl) },
        ].map((item) => (
          <Card key={item.label}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className={`mt-1 text-lg font-bold ${item.cls ?? 'text-slate-900 dark:text-slate-50'}`}>{item.value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <DataTable data={data} columns={columns} loading={loading} onEdit={handleEdit} onDelete={(id) => remove(id)} onAdd={openAdd} addLabel="Add Policy" searchKey="instrument" searchPlaceholder="Search policy..." />
      </Card>
      <EditModal isOpen={!!editRow || isAdding} onClose={closeModal} title={editRow ? `Edit — ${editRow.instrument}` : 'Add Policy'} onSubmit={handleSubmit} loading={saving}>
        <FieldGrid>
          <div className="col-span-2"><Field label="Policy Name" name="instrument" required defaultValue={editRow?.instrument} /></div>
          <Field label="Policy Number"   name="policyNumber"   required defaultValue={editRow?.policyNumber} />
          <Field label="Provider"        name="platform"       required defaultValue={editRow?.platform}     placeholder="LIC / HDFC Life" />
          <Field label="Type"            name="type"           required defaultValue={editRow?.type}         placeholder="Term / ULIP / Endowment" />
          <Field label="Annual Premium"  name="annualPremium"  type="number" step="0.01" required value={annualPremium}  onChange={setAnnualPremium} />
          <Field label="Total Paid"      name="purchaseAmount" type="number" step="0.01" required value={purchaseVal}    onChange={setPurchaseVal} />
          <Field label="Current Value"   name="currentAmount"  type="number" step="0.01" required value={currentVal}     onChange={setCurrentVal} />
        </FieldGrid>
      </EditModal>
    </AppShell>
  )
}
