'use client'

import { useState } from 'react'
import { CategoryBanner } from '@/components/ui/CategoryBanner'
import { DataTable, Column } from '@/components/ui/DataTable'
import { EditModal, Field, FieldGrid } from '@/components/ui/EditModal'
import { Card } from '@/components/ui/Card'
import { pnlClass } from '@/lib/utils'
import { useCurrency } from '@/context/CurrencyContext'
import { useAsset } from '@/hooks/useAsset'
import type { CashAccount } from '@/lib/types'

export default function CashBankingPage() {
  const { format } = useCurrency()
  const { data, loading, create, update, remove } = useAsset<CashAccount>('/api/cash-banking')

  const [editRow, setEditRow] = useState<CashAccount | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [currentVal, setCurrentVal] = useState('')

  const currentAmount = parseFloat(currentVal) || 0

  const columns: Column<CashAccount>[] = [
    { key: 'instrument',    label: 'Account Name' },
    { key: 'accountNumber', label: 'Account #',   className: 'font-mono text-xs' },
    { key: 'type',          label: 'Type' },
    { key: 'currentAmount', label: 'Balance',      render: (v) => format(Number(v)) },
    { key: 'platform',      label: 'Bank' },
  ]

  const totals = data.reduce((acc, h) => ({ invested: acc.invested + h.purchaseAmount, current: acc.current + h.currentAmount, pnl: acc.pnl + h.pnl }), { invested: 0, current: 0, pnl: 0 })

  const openAdd    = () => { setEditRow(null); setCurrentVal(''); setIsAdding(true) }
  const closeModal = () => { setEditRow(null); setIsAdding(false) }

  const handleEdit = (row: CashAccount) => {
    setEditRow(row)
    setCurrentVal(String(row.currentAmount))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const form = e.target as HTMLFormElement
    const fd = new FormData(form)
    const fields = {
      instrument:    fd.get('instrument') as string,
      accountNumber: fd.get('accountNumber') as string,
      type:          fd.get('type') as string,
      purchaseAmount: currentAmount,
      currentAmount,
      pnl:           0,
      netChange:     0,
      platform:      fd.get('platform') as string,
    }
    if (editRow) { await update(editRow.id, fields) } else { await create(fields) }
    setSaving(false)
    closeModal()
  }

  return (
    <>
      <CategoryBanner slug="cash-banking" />
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
        <DataTable data={data} columns={columns} loading={loading} onEdit={handleEdit} onDelete={(id) => remove(id)} onAdd={openAdd} addLabel="Add Account" searchKey="instrument" searchPlaceholder="Search account..." />
      </Card>
      <EditModal isOpen={!!editRow || isAdding} onClose={closeModal} title={editRow ? `Edit — ${editRow.instrument}` : 'Add Account'} onSubmit={handleSubmit} loading={saving}>
        <FieldGrid>
          <Field label="Account Name"   name="instrument"    required defaultValue={editRow?.instrument}    placeholder="HDFC Savings" />
          <Field label="Bank"           name="platform"      required defaultValue={editRow?.platform}      placeholder="HDFC Bank" />
          <Field label="Account Number" name="accountNumber" required defaultValue={editRow?.accountNumber} placeholder="XXXXXXXXXXXX" />
          <Field label="Type"           name="type"          required defaultValue={editRow?.type}          placeholder="Savings / Current / Wallet" />
          <Field label="Balance"        name="currentAmount" type="number" step="0.01" required value={currentVal} onChange={setCurrentVal} />
        </FieldGrid>
      </EditModal>
    </>
  )
}
