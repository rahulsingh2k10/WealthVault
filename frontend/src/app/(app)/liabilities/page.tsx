'use client'

import { useState } from 'react'
import { CategoryBanner } from '@/components/ui/CategoryBanner'
import { DataTable, Column } from '@/components/ui/DataTable'
import { EditModal, Field, FieldGrid } from '@/components/ui/EditModal'
import { Card } from '@/components/ui/Card'
import { pnlClass } from '@/lib/utils'
import { useCurrency } from '@/context/CurrencyContext'
import { useAsset } from '@/hooks/useAsset'
import type { Liability } from '@/lib/types'

export default function LiabilitiesPage() {
  const { format } = useCurrency()
  const { data, loading, create, update, remove } = useAsset<Liability>('/api/liabilities')

  const [editRow, setEditRow] = useState<Liability | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [originalVal, setOriginalVal] = useState('')
  const [outstandingVal, setOutstandingVal] = useState('')

  const purchaseAmount = parseFloat(originalVal) || 0
  const currentAmount  = parseFloat(outstandingVal) || 0

  const columns: Column<Liability>[] = [
    { key: 'instrument',    label: 'Loan / Debt' },
    { key: 'type',          label: 'Type' },
    { key: 'purchaseAmount', label: 'Original Amt', render: (v) => format(Number(v)) },
    { key: 'currentAmount', label: 'Outstanding',   render: (v) => format(Number(v)) },
    { key: 'platform',      label: 'Lender' },
  ]

  const totals = data.reduce((acc, h) => ({ invested: acc.invested + h.purchaseAmount, current: acc.current + h.currentAmount, pnl: acc.pnl + h.pnl }), { invested: 0, current: 0, pnl: 0 })

  const openAdd    = () => { setEditRow(null); setOriginalVal(''); setOutstandingVal(''); setIsAdding(true) }
  const closeModal = () => { setEditRow(null); setIsAdding(false) }

  const handleEdit = (row: Liability) => {
    setEditRow(row)
    setOriginalVal(String(row.purchaseAmount))
    setOutstandingVal(String(row.currentAmount))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    const fields = {
      instrument:    fd.get('instrument') as string,
      type:          fd.get('type') as string,
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
    <>
      <CategoryBanner slug="liabilities" />
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Original Amount', value: format(totals.invested) },
          { label: 'Outstanding',     value: format(totals.current) },
          { label: 'Repaid', value: `${totals.pnl >= 0 ? '+' : ''}${format(Math.abs(totals.pnl))}`, cls: pnlClass(-totals.pnl) },
        ].map((item) => (
          <Card key={item.label}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
            <p className={`mt-1 text-lg font-bold ${item.cls ?? 'text-slate-900 dark:text-slate-50'}`}>{item.value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <DataTable data={data} columns={columns} loading={loading} onEdit={handleEdit} onDelete={(id) => remove(id)} onAdd={openAdd} addLabel="Add Liability" searchKey="instrument" searchPlaceholder="Search loan..." />
      </Card>
      <EditModal isOpen={!!editRow || isAdding} onClose={closeModal} title={editRow ? `Edit — ${editRow.instrument}` : 'Add Liability'} onSubmit={handleSubmit} loading={saving}>
        <FieldGrid>
          <Field label="Loan / Debt Name" name="instrument"    required defaultValue={editRow?.instrument} placeholder="Home Loan" />
          <Field label="Type"             name="type"          required defaultValue={editRow?.type}       placeholder="Home / Car / Personal / Credit Card" />
          <Field label="Lender"           name="platform"      required defaultValue={editRow?.platform}   placeholder="HDFC Bank" />
          <Field label="Original Amount"  name="purchaseAmount" type="number" step="0.01" required value={originalVal}     onChange={setOriginalVal} />
          <Field label="Outstanding"      name="currentAmount"  type="number" step="0.01" required value={outstandingVal}  onChange={setOutstandingVal} />
        </FieldGrid>
      </EditModal>
    </>
  )
}
